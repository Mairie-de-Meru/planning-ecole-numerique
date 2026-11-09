import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { adminCreateReservation, bookReservation, cancelReservation, confirmReservation, moveReservation } from "@/lib/reservations";
import { conventionPdf, getConventionByReservation, signConvention } from "@/lib/conventions";
import { fillTemplate, parseBlocks, pdfSafe, toHtml } from "@/lib/convention-doc";
import { updateSettings } from "@/lib/settings";

let itemId = "";
let p1 = "";
let p2 = "";
let schoolId = "";
const sign = { accepted: true, signerName: "Estelle MENDES", signerTitle: "Directrice", storageLocation: "Bureau de direction", emailCopy: true };
const tokenOf = (url: string) => url.split("/confirmer/")[1];

beforeEach(async () => {
  await db.execute(sql`truncate conventions, convention_templates, reservations, audit_log, mail_log, periods, items, schools, settings, admins cascade`);
  await updateSettings({ zone: "B", notifyAdmin: false });
  [{ id: itemId }] = await db
    .insert(schema.items)
    .values({
      name: "Robots Bluebots",
      contents: "Un sac de transport contenant 6 robots, un lecteur de programmation et des tapis de jeu",
      inventory: "Robot Bluebots 1 | RBLUEBOT1 | 1 | Bon état\nLecteur de programmation | TR1 | 1 | Bon état\nLingettes nettoyantes | N/A | 1",
    })
    .returning();
  [{ id: p1 }, { id: p2 }] = await db
    .insert(schema.periods)
    .values([
      { schoolYear: "2030-2031", position: 2, label: "Toussaint → Noël", startDate: "2030-11-04", endDate: "2030-12-20", zone: "B" },
      { schoolYear: "2030-2031", position: 3, label: "Noël → Hiver", startDate: "2031-01-06", endDate: "2031-02-14", zone: "B" },
    ])
    .returning();
  [{ id: schoolId }] = await db
    .insert(schema.schools)
    .values({ email: "bellonte@ecole.fr", name: "École maternelle Bellonte", address: "1 rue Bellonte\n60110 Méru", directorName: "Estelle MENDES" })
    .returning();
});

describe("modèle", () => {
  it("remplit les champs et produit un HTML échappé", () => {
    const filled = fillTemplate("# Titre\n**{{ecole}}** et {{inconnu}}\n- a <b>", { ecole: "Bellonte" });
    expect(parseBlocks(filled).map((b) => b.t)).toEqual(["h1", "p", "li"]);
    const html = toHtml(filled);
    expect(html).toContain("<strong>Bellonte</strong>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('<mark class="field">inconnu</mark>');
  });
  it("rend le texte compatible avec les polices PDF", () => {
    expect(pdfSafe("Toussaint → Noël 2 nov. –")).toBe("Toussaint – Noël 2 nov. –");
  });
});

describe("conventions", () => {
  it("la réservation exige l'acceptation de la convention", async () => {
    await expect(
      bookReservation({ schoolId, itemId, periodId: p1, actorEmail: "bellonte@ecole.fr", sign: { ...sign, accepted: false } }),
    ).rejects.toThrow(/J'ai lu et j'accepte/);
    expect(await db.select().from(schema.reservations)).toHaveLength(0);
  });

  it("convention signée, pré-remplie, envoyée en PDF à la confirmation", async () => {
    const { confirmUrl, reservation } = await bookReservation({ schoolId, itemId, periodId: p1, actorEmail: "bellonte@ecole.fr", sign, ip: "1.2.3.4" });
    const c = (await getConventionByReservation(reservation.id))!;
    expect(c.convention.status).toBe("signed");
    expect(c.convention.signedIp).toBe("1.2.3.4");
    expect(c.convention.body).toContain("**École maternelle Bellonte**");
    expect(c.convention.body).toContain("un lecteur de programmation et des tapis de jeu.");
    expect(c.convention.body).toContain("**Bureau de direction**");
    expect(c.convention.body).toContain("Monsieur Abdelafid MOKHTARI, Maire");
    expect(c.convention.body).toContain("uniquement par le service informatique de la Ville de Méru");
    expect(c.convention.loanSheet).toEqual([
      { label: "Robot Bluebots 1", serial: "RBLUEBOT1", qty: 1, state: "Bon état", stateOut: null, stateIn: null },
      { label: "Lecteur de programmation", serial: "TR1", qty: 1, state: "Bon état", stateOut: null, stateIn: null },
      { label: "Lingettes nettoyantes", serial: "", qty: 1, state: "", stateOut: null, stateIn: null },
    ]);
    expect(c.convention.body).not.toMatch(/\{\{/);
    await confirmReservation(tokenOf(confirmUrl));
    const pdf = (await conventionPdf(c.convention.id))!;
    expect(pdf.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.filename).toMatch(/^convention-\d{4}-\d{4}-ecole-maternelle-bellonte\.pdf$/);
    const mails = await db.select().from(schema.mailLog);
    expect(mails.find((m) => m.subject.startsWith("Réservation confirmée"))?.text).toContain("Convention");
  });

  it("réservation par l'admin : convention à signer, puis signée par l'école", async () => {
    const r = await adminCreateReservation({ schoolId, itemId, periodId: p1, adminEmail: "admin@mairie.fr" });
    const c = (await getConventionByReservation(r.id))!;
    expect(c.convention.status).toBe("to_sign");
    expect(c.convention.body).toContain("Estelle MENDES");
    expect(c.convention.body).toContain("à préciser par l'école lors de la signature");
    await signConvention({
      conventionId: c.convention.id,
      schoolId,
      email: "bellonte@ecole.fr",
      sign: { ...sign, signatureImage: "data:image/png;base64,iVBORw0KGgo=" },
    });
    const after = (await getConventionByReservation(r.id))!;
    expect(after.convention.status).toBe("signed");
    expect(after.convention.signatureMethod).toBe("drawn");
    expect(after.convention.body).toContain("**Bureau de direction**");
    await expect(signConvention({ conventionId: c.convention.id, schoolId, email: "x", sign })).rejects.toThrow(/plus à signer/);
  });

  it("le décalage met à jour les dates et trace la modification ; l'annulation clôt la convention", async () => {
    const { confirmUrl, reservation } = await bookReservation({ schoolId, itemId, periodId: p1, actorEmail: "bellonte@ecole.fr", sign });
    await confirmReservation(tokenOf(confirmUrl));
    await moveReservation({ reservationId: reservation.id, periodId: p2, actor: { type: "school", schoolId, email: "bellonte@ecole.fr" } });
    let c = (await getConventionByReservation(reservation.id))!;
    expect(c.convention.body).toContain("période 3");
    expect(c.convention.status).toBe("signed");
    expect((c.convention.amendments as unknown[]).length).toBe(1);
    await cancelReservation({ reservationId: reservation.id, actor: { type: "school", schoolId, email: "bellonte@ecole.fr" } });
    c = (await getConventionByReservation(reservation.id))!;
    expect(c.convention.status).toBe("cancelled");
  });

  it("une réservation expirée annule sa convention", async () => {
    const { reservation } = await bookReservation({ schoolId, itemId, periodId: p1, actorEmail: "bellonte@ecole.fr", sign });
    await db.update(schema.reservations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.reservations.id, reservation.id));
    const { expireStalePending } = await import("@/lib/reservations");
    await expireStalePending();
    expect((await getConventionByReservation(reservation.id))!.convention.status).toBe("cancelled");
  });
});

describe("fiche de prêt", () => {
  it("remise puis reprise : états enregistrés et inventaire de la mallette mis à jour", async () => {
    const { recordDelivery, recordReturn } = await import("@/lib/conventions");
    const { reservation } = await bookReservation({ schoolId, itemId, periodId: p1, actorEmail: "bellonte@ecole.fr", sign });
    const c = (await getConventionByReservation(reservation.id))!;
    await expect(recordReturn(c.convention.id, { at: "2030-12-20", by: "Gildas DUMONT", note: "", states: [] })).rejects.toThrow(/remise/);
    await recordDelivery(c.convention.id, { at: "2030-11-04", by: "Gildas DUMONT", note: "Matériel livré chargé et nettoyé.", states: ["Très bon état"] });
    await expect(recordReturn(c.convention.id, { at: "2030-11-01", by: "Gildas DUMONT", note: "", states: [] })).rejects.toThrow(/précède/);
    await recordReturn(c.convention.id, { at: "2030-12-19", by: "Gildas DUMONT", note: "Robot 1 rayé", states: ["Usé", "", ""] });
    const after = (await getConventionByReservation(reservation.id))!;
    const sheet = after.convention.loanSheet as { stateOut: string | null; stateIn: string | null }[];
    expect(sheet.map((l) => [l.stateOut, l.stateIn])).toEqual([
      ["Très bon état", "Usé"],
      ["Bon état", "Bon état"],
      [null, null],
    ]);
    const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
    expect(item.inventory.split("\n")[0]).toBe("Robot Bluebots 1 | RBLUEBOT1 | 1 | Usé");
    const pdf = (await conventionPdf(c.convention.id))!;
    expect(pdf.buffer.length).toBeGreaterThan(3000);
  });
});
