import { beforeEach, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  bookReservation,
  cancelReservation,
  confirmReservation,
  moveReservation,
  getPlanning,
  BookingError,
} from "@/lib/reservations";
import { updateSettings } from "@/lib/settings";

let itemId = "";
let item2 = "";
let p1 = "";
let p2 = "";
let pPast = "";
let schoolA = "";
let schoolB = "";

const tokenOf = (url: string) => url.split("/confirmer/")[1];
const sign = { accepted: true, signerName: "Mme Test", signerTitle: "Directrice", emailCopy: false };

beforeEach(async () => {
  await db.execute(sql`truncate conventions, convention_templates, reservations, audit_log, mail_log, periods, items, schools, settings, admins cascade`);
  await updateSettings({ zone: "B", confirmTtlMinutes: 30, maxPerSchoolPerPeriod: 0, notifyAdmin: true });
  await db.insert(schema.admins).values({ email: "admin@test.fr" });
  [{ id: itemId }, { id: item2 }] = await db
    .insert(schema.items)
    .values([{ name: "Valise tablettes" }, { name: "Valise robots" }])
    .returning();
  const per = await db
    .insert(schema.periods)
    .values([
      { schoolYear: "2030-2031", position: 2, label: "Toussaint → Noël", startDate: "2030-11-04", endDate: "2030-12-20", zone: "B" },
      { schoolYear: "2030-2031", position: 3, label: "Noël → Hiver", startDate: "2031-01-06", endDate: "2031-02-14", zone: "B" },
      { schoolYear: "2020-2021", position: 1, label: "Rentrée → Toussaint", startDate: "2020-09-01", endDate: "2020-10-16", zone: "B" },
    ])
    .returning();
  [p1, p2, pPast] = per.map((p) => p.id);
  [{ id: schoolA }, { id: schoolB }] = await db
    .insert(schema.schools)
    .values([
      { email: "a@ecole.fr", name: "École A", address: "1 rue A" },
      { email: "b@ecole.fr", name: "École B", address: "2 rue B" },
    ])
    .returning();
});

describe("premier réservé, premier servi", () => {
  it("20 réservations simultanées du même créneau : une seule réussit", async () => {
    const schools = await db
      .insert(schema.schools)
      .values(Array.from({ length: 20 }, (_, i) => ({ email: `s${i}@ecole.fr`, name: `S${i}`, address: "x" })))
      .returning();
    const results = await Promise.allSettled(
      schools.map((s) => bookReservation({ schoolId: s.id, itemId, periodId: p1, actorEmail: s.email!, sign })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const ko = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(ko.every((r) => r.reason instanceof BookingError)).toBe(true);
  });

  it("parcours complet : en attente → confirmée, avec e-mails", async () => {
    const { confirmUrl } = await bookReservation({ schoolId: schoolA, itemId, periodId: p1, actorEmail: "a@ecole.fr", sign });
    let plan = await getPlanning({ zone: "B", schoolYear: "2030-2031" });
    expect(plan.slots.get(`${itemId}:${p1}`)?.status).toBe("pending");
    // Une autre école ne peut pas prendre le créneau en attente.
    await expect(bookReservation({ schoolId: schoolB, itemId, periodId: p1, actorEmail: "b@ecole.fr", sign })).rejects.toThrow(/Trop tard/);
    await confirmReservation(tokenOf(confirmUrl));
    plan = await getPlanning({ zone: "B", schoolYear: "2030-2031" });
    expect(plan.slots.get(`${itemId}:${p1}`)?.status).toBe("confirmed");
    // Lien à usage unique
    await expect(confirmReservation(tokenOf(confirmUrl))).rejects.toThrow(BookingError);
    const mails = await db.select().from(schema.mailLog);
    const subjects = mails.map((m) => m.subject).sort();
    expect(subjects).toEqual([
      "Réservation confirmée : Valise tablettes — Toussaint → Noël",
      "[Admin] Nouvelle réservation : Valise tablettes",
      "À confirmer : Valise tablettes — Toussaint → Noël",
    ].sort());
  });

  it("notification admin désactivable", async () => {
    await updateSettings({ notifyAdmin: false });
    const { confirmUrl } = await bookReservation({ schoolId: schoolA, itemId, periodId: p1, actorEmail: "a@ecole.fr", sign });
    await confirmReservation(tokenOf(confirmUrl));
    const mails = await db.select().from(schema.mailLog);
    expect(mails.some((m) => m.subject.startsWith("[Admin]"))).toBe(false);
  });

  it("une réservation non confirmée à temps libère le créneau", async () => {
    const { confirmUrl, reservation } = await bookReservation({ schoolId: schoolA, itemId, periodId: p1, actorEmail: "a@ecole.fr", sign });
    await db.update(schema.reservations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.reservations.id, reservation.id));
    await expect(confirmReservation(tokenOf(confirmUrl))).rejects.toThrow(/délai/);
    await bookReservation({ schoolId: schoolB, itemId, periodId: p1, actorEmail: "b@ecole.fr", sign });
  });

  it("refuse une période passée", async () => {
    await expect(bookReservation({ schoolId: schoolA, itemId, periodId: pPast, actorEmail: "a@ecole.fr", sign })).rejects.toThrow(/terminée/);
  });

  it("plafond par école et par période (réglage admin)", async () => {
    await updateSettings({ maxPerSchoolPerPeriod: 1 });
    await bookReservation({ schoolId: schoolA, itemId, periodId: p1, actorEmail: "a@ecole.fr", sign });
    await expect(bookReservation({ schoolId: schoolA, itemId: item2, periodId: p1, actorEmail: "a@ecole.fr", sign })).rejects.toThrow(/déjà une mallette/);
    await bookReservation({ schoolId: schoolA, itemId: item2, periodId: p2, actorEmail: "a@ecole.fr", sign });
  });
});

describe("décalage et annulation", () => {
  async function confirmed(schoolId: string, email: string, periodId: string) {
    const { confirmUrl, reservation } = await bookReservation({ schoolId, itemId, periodId, actorEmail: email, sign });
    await confirmReservation(tokenOf(confirmUrl));
    return reservation.id;
  }

  it("décale vers une période libre", async () => {
    const id = await confirmed(schoolA, "a@ecole.fr", p1);
    await moveReservation({ reservationId: id, periodId: p2, actor: { type: "school", schoolId: schoolA, email: "a@ecole.fr" } });
    const plan = await getPlanning({ zone: "B", schoolYear: "2030-2031" });
    expect(plan.slots.has(`${itemId}:${p1}`)).toBe(false);
    expect(plan.slots.get(`${itemId}:${p2}`)?.schoolId).toBe(schoolA);
  });

  it("refuse un décalage vers une période prise, sans rien changer", async () => {
    const a = await confirmed(schoolA, "a@ecole.fr", p1);
    await confirmed(schoolB, "b@ecole.fr", p2);
    await expect(
      moveReservation({ reservationId: a, periodId: p2, actor: { type: "school", schoolId: schoolA, email: "a@ecole.fr" } }),
    ).rejects.toThrow(/vient d'être réservée/);
    const plan = await getPlanning({ zone: "B", schoolYear: "2030-2031" });
    expect(plan.slots.get(`${itemId}:${p1}`)?.schoolId).toBe(schoolA);
  });

  it("une école ne peut pas toucher la réservation d'une autre", async () => {
    const a = await confirmed(schoolA, "a@ecole.fr", p1);
    const actor = { type: "school" as const, schoolId: schoolB, email: "b@ecole.fr" };
    await expect(moveReservation({ reservationId: a, periodId: p2, actor })).rejects.toThrow(/appartient/);
    await expect(cancelReservation({ reservationId: a, actor })).rejects.toThrow(/appartient/);
  });

  it("annulation : le créneau redevient libre", async () => {
    const a = await confirmed(schoolA, "a@ecole.fr", p1);
    await cancelReservation({ reservationId: a, actor: { type: "school", schoolId: schoolA, email: "a@ecole.fr" } });
    await bookReservation({ schoolId: schoolB, itemId, periodId: p1, actorEmail: "b@ecole.fr", sign });
  });

  it("l'admin peut changer de valise et de période", async () => {
    const a = await confirmed(schoolA, "a@ecole.fr", p1);
    await moveReservation({ reservationId: a, periodId: p2, itemId: item2, actor: { type: "admin", email: "admin@test.fr" } });
    const plan = await getPlanning({ zone: "B", schoolYear: "2030-2031" });
    expect(plan.slots.get(`${item2}:${p2}`)?.schoolId).toBe(schoolA);
  });
});
