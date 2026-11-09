import { and, asc, count, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Item, Period, Reservation, School } from "@/db/schema";
import { frLong, periodState, todayParis } from "./dates";
import { icsEvent, periodFacts, renderMail, sendMail } from "./mail";
import { adminEmails, appUrl, getSettings } from "./settings";
import { hashToken, newToken } from "./tokens";
import { BookingError } from "./errors";
import {
  cancelConventions,
  conventionAttachment,
  conventionNumber,
  createConvention,
  formatStamp,
  getConventionByReservation,
  updateConventionAfterMove,
  validateSign,
  type SignInput,
} from "./conventions";

export { BookingError };

export type Actor = { type: "school"; schoolId: string; email: string } | { type: "admin"; email: string };

const ACTIVE = ["pending", "confirmed"] as const;

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object" && cur && "code" in cur && (cur as { code: unknown }).code === "23505") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** Passe en "expirée" les réservations non confirmées à temps (libère les créneaux). */
export async function expireStalePending(): Promise<number> {
  const rows = await db
    .update(schema.reservations)
    .set({ status: "expired", confirmTokenHash: null, updatedAt: new Date() })
    .where(and(eq(schema.reservations.status, "pending"), lt(schema.reservations.expiresAt, new Date())))
    .returning({ id: schema.reservations.id });
  await cancelConventions(rows.map((r) => r.id));
  return rows.length;
}

async function loadFull(id: string) {
  const [row] = await db
    .select({ r: schema.reservations, item: schema.items, period: schema.periods, school: schema.schools })
    .from(schema.reservations)
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.reservations.periodId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
    .where(eq(schema.reservations.id, id));
  return row ?? null;
}

async function audit(actor: Actor | { type: "system" }, action: string, reservationId: string | null, details?: unknown) {
  await db.insert(schema.auditLog).values({
    actor: actor.type === "system" ? "système" : actor.email,
    action,
    reservationId,
    details: details ?? null,
  });
}

async function checkLimit(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], schoolId: string, periodId: string, max: number, excludeId?: string) {
  if (max <= 0) return;
  const conds = [
    eq(schema.reservations.schoolId, schoolId),
    eq(schema.reservations.periodId, periodId),
    inArray(schema.reservations.status, [...ACTIVE]),
    or(eq(schema.reservations.status, "confirmed"), gt(schema.reservations.expiresAt, new Date())),
  ];
  if (excludeId) conds.push(sql`${schema.reservations.id} <> ${excludeId}`);
  const [{ n }] = await tx.select({ n: count() }).from(schema.reservations).where(and(...conds));
  if (n >= max)
    throw new BookingError(
      max === 1
        ? "Votre école a déjà une mallette réservée sur cette période."
        : `Votre école a déjà ${n} mallettes réservées sur cette période (maximum ${max}).`,
    );
}

/* ------------------------------------------------------------------ */
/* Réservation par une école : en attente puis confirmation par e-mail */
/* ------------------------------------------------------------------ */

export async function bookReservation(input: {
  schoolId: string;
  itemId: string;
  periodId: string;
  actorEmail: string;
  sign: SignInput;
  ip?: string | null;
}) {
  validateSign(input.sign);
  const settings = await getSettings();
  const today = todayParis();
  const { token, hash } = newToken();
  await expireStalePending();

  let reservation: Reservation;
  try {
    reservation = await db.transaction(async (tx) => {
      // Sérialise les réservations d'une même école (contrôle du plafond).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.schoolId}))`);
      const [item] = await tx.select().from(schema.items).where(eq(schema.items.id, input.itemId));
      if (!item || !item.active) throw new BookingError("Cette mallette n'est plus proposée.");
      const [period] = await tx.select().from(schema.periods).where(eq(schema.periods.id, input.periodId));
      if (!period) throw new BookingError("Période introuvable.");
      if (period.endDate < today) throw new BookingError("Cette période est terminée.");
      await checkLimit(tx, input.schoolId, input.periodId, settings.maxPerSchoolPerPeriod);
      const [r] = await tx
        .insert(schema.reservations)
        .values({
          itemId: input.itemId,
          periodId: input.periodId,
          schoolId: input.schoolId,
          status: "pending",
          confirmTokenHash: hash,
          expiresAt: new Date(Date.now() + settings.confirmTtlMinutes * 60_000),
        })
        .returning();
      // La convention est acceptée en même temps que la réservation.
      await createConvention(tx, { reservationId: r.id, sign: { ...input.sign, email: input.actorEmail, ip: input.ip } });
      return r;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new BookingError("Trop tard : cette mallette vient d'être réservée pour cette période par une autre école.");
    throw e;
  }

  const full = (await loadFull(reservation.id))!;
  const url = `${appUrl()}/confirmer/${token}`;
  const { html, text } = renderMail({
    appName: settings.appName,
    title: "Confirmez votre réservation",
    blocks: [
      {
        kind: "p",
        text: `Bonjour, vous avez demandé à réserver « ${full.item.name} » et accepté la convention de prêt. Pour valider la réservation, cliquez sur le bouton ci-dessous.`,
      },
      { kind: "facts", rows: [["Mallette", full.item.name], ...periodFacts(full.period), ["École", full.school.name]] },
      { kind: "note", text: `Sans confirmation dans les ${settings.confirmTtlMinutes} minutes, la mallette sera de nouveau proposée aux autres écoles.` },
    ],
    button: { label: "Confirmer la réservation", url },
  });
  try {
    await sendMail({ to: full.school.email ?? [], subject: `À confirmer : ${full.item.name} — ${full.period.label}`, html, text });
  } catch {
    await db.update(schema.reservations).set({ status: "cancelled", confirmTokenHash: null }).where(eq(schema.reservations.id, reservation.id));
    await cancelConventions([reservation.id]);
    throw new BookingError("L'e-mail de confirmation n'a pas pu être envoyé. Réessayez dans un instant.");
  }
  await audit({ type: "school", schoolId: input.schoolId, email: input.actorEmail }, "réservation demandée", reservation.id);
  return { reservation, confirmUrl: url };
}

export async function peekByToken(token: string) {
  const [row] = await db
    .select({ id: schema.reservations.id })
    .from(schema.reservations)
    .where(eq(schema.reservations.confirmTokenHash, hashToken(token)));
  return row ? loadFull(row.id) : null;
}

export async function confirmReservation(token: string) {
  const full = await peekByToken(token);
  if (!full) throw new BookingError("Ce lien n'est plus valable (déjà utilisé ou réservation annulée).");
  if (full.r.status === "confirmed") throw new BookingError("Cette réservation est déjà confirmée.");
  if (full.r.status !== "pending") throw new BookingError("Cette réservation n'est plus en attente de confirmation.");
  if (full.r.expiresAt && full.r.expiresAt < new Date()) {
    await expireStalePending();
    throw new BookingError("Le délai de confirmation est dépassé : la mallette a été remise à disposition. Vous pouvez la réserver de nouveau si elle est libre.");
  }
  const [r] = await db
    .update(schema.reservations)
    // Le jeton est conservé : le lien de l'e-mail affiche ensuite « réservation confirmée ».
    .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.reservations.id, full.r.id), eq(schema.reservations.status, "pending")))
    .returning();
  if (!r) throw new BookingError("Cette réservation n'est plus en attente de confirmation.");
  await audit({ type: "school", schoolId: full.school.id, email: full.school.email ?? "" }, "réservation confirmée", r.id);
  await notifyConfirmed(full.item, full.period, full.school, r.id, false);
  return { ...full, r };
}

async function notifyConfirmed(item: Item, period: Period, school: School, reservationId: string, byAdmin: boolean) {
  const settings = await getSettings();
  const conv = await getConventionByReservation(reservationId);
  const convRows: [string, string][] = conv
    ? [["Convention", `n° ${conventionNumber(conv.convention)}${conv.convention.signedAt ? ` — acceptée le ${formatStamp(conv.convention.signedAt)}` : ""}`]]
    : [];
  const attachments = [];
  if (conv?.convention.emailCopy) {
    // Un problème de PDF ne doit jamais bloquer la confirmation.
    const pdf = await conventionAttachment(conv.convention.id).catch((e) => {
      console.error("pdf", e);
      return null;
    });
    if (pdf) attachments.push(pdf);
  }
  const { html, text } = renderMail({
    appName: settings.appName,
    title: "Votre réservation est faite",
    blocks: [
      {
        kind: "p",
        text: byAdmin
          ? `Le gestionnaire a réservé « ${item.name} » pour votre école.`
          : `C'est confirmé : « ${item.name} » est réservée pour votre école.`,
      },
      { kind: "facts", rows: [["Mallette", item.name], ...periodFacts(period), ["Livraison", school.address || "—"], ...convRows] },
      {
        kind: "p",
        text: "La mallette sera livrée et reprise à l'école par le service informatique. Vous pouvez décaler ou annuler la réservation depuis « Mes réservations ».",
      },
      ...(attachments.length ? [{ kind: "note" as const, text: "La convention de prêt est jointe à cet e-mail (PDF)." }] : []),
    ],
    button: { label: "Voir mes réservations", url: `${appUrl()}/reservations` },
  });
  await sendMail({
    to: school.email ?? [],
    subject: `Réservation confirmée : ${item.name} — ${period.label}`,
    html,
    text,
    attachments: [
      ...attachments,
      icsEvent({
        uid: `${reservationId}@mallettes`,
        title: `Mallette : ${item.name}`,
        description: `${period.label} — ${settings.appName}`,
        start: period.startDate,
        end: period.endDate,
      }),
    ],
  }).catch((e) => console.error("mail", e));
  await notifyAdmins(`Nouvelle réservation : ${item.name}`, [
    ["École", school.name || school.email || "—"],
    ["Mallette", item.name],
    ...periodFacts(period),
    ["Livraison", school.address || "—"],
    ...convRows,
  ]);
}

async function notifyAdmins(subject: string, rows: [string, string][]) {
  const settings = await getSettings();
  if (!settings.notifyAdmin) return;
  const to = await adminEmails();
  if (!to.length) return;
  const { html, text } = renderMail({
    appName: settings.appName,
    title: subject,
    blocks: [{ kind: "facts", rows }],
    button: { label: "Ouvrir le planning", url: `${appUrl()}/admin` },
  });
  await sendMail({ to, subject: `[Admin] ${subject}`, html, text }).catch((e) => console.error("mail", e));
}

/* ------------------------------------------------------------------ */
/* Décalage / annulation                                               */
/* ------------------------------------------------------------------ */

export async function moveReservation(input: { reservationId: string; periodId: string; itemId?: string; actor: Actor }) {
  const settings = await getSettings();
  const today = todayParis();
  const before = await loadFull(input.reservationId);
  if (!before) throw new BookingError("Réservation introuvable.");
  const { actor } = input;
  const targetItemId = actor.type === "admin" && input.itemId ? input.itemId : before.r.itemId;

  if (actor.type === "school") {
    if (before.r.schoolId !== actor.schoolId) throw new BookingError("Cette réservation ne vous appartient pas.");
    if (before.r.status !== "confirmed") throw new BookingError("Seule une réservation confirmée peut être décalée.");
    if (periodState(before.period, today) !== "upcoming")
      throw new BookingError("La période a déjà commencé : contactez le gestionnaire pour toute modification.");
  } else if (!ACTIVE.includes(before.r.status as (typeof ACTIVE)[number])) {
    throw new BookingError("Cette réservation n'est plus active.");
  }
  if (input.periodId === before.r.periodId && targetItemId === before.r.itemId) return before;

  await expireStalePending();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${before.r.schoolId}))`);
      const [period] = await tx.select().from(schema.periods).where(eq(schema.periods.id, input.periodId));
      if (!period) throw new BookingError("Période introuvable.");
      if (period.endDate < today) throw new BookingError("Cette période est terminée.");
      if (actor.type === "school") await checkLimit(tx, before.r.schoolId, input.periodId, settings.maxPerSchoolPerPeriod, before.r.id);
      await tx
        .update(schema.reservations)
        .set({ periodId: input.periodId, itemId: targetItemId, updatedAt: new Date() })
        .where(eq(schema.reservations.id, before.r.id));
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new BookingError("Cette période vient d'être réservée par une autre école. Votre réservation n'a pas changé.");
    throw e;
  }
  const after = (await loadFull(before.r.id))!;
  await updateConventionAfterMove(
    before.r.id,
    `${actor.type === "admin" ? "Modifiée par le gestionnaire" : "Décalée par l'école"} : ${before.item.name}, période ${before.period.position} (${before.period.schoolYear}), remplacée par ${after.item.name}, période ${after.period.position} (${after.period.schoolYear}), du ${frLong(after.period.startDate)} au ${frLong(after.period.endDate)}.`,
  );
  await audit(actor, "réservation décalée", before.r.id, {
    from: { period: before.period.label, year: before.period.schoolYear, item: before.item.name },
    to: { period: after.period.label, year: after.period.schoolYear, item: after.item.name },
  });

  if (after.r.status === "confirmed") {
    const { html, text } = renderMail({
      appName: settings.appName,
      title: "Votre réservation a été décalée",
      blocks: [
        { kind: "p", text: actor.type === "admin" ? "Le gestionnaire a modifié votre réservation." : "Votre réservation a bien été décalée." },
        { kind: "facts", rows: [["Mallette", after.item.name], ...periodFacts(after.period)] },
        { kind: "note", text: `Ancienne période : ${before.period.label} (${before.period.schoolYear})${before.item.id !== after.item.id ? ` — ancienne mallette : ${before.item.name}` : ""}.` },
      ],
      button: { label: "Voir mes réservations", url: `${appUrl()}/reservations` },
    });
    await sendMail({
      to: after.school.email ?? [],
      subject: `Réservation décalée : ${after.item.name} — ${after.period.label}`,
      html,
      text,
      attachments: [
        icsEvent({ uid: `${after.r.id}@mallettes`, title: `Mallette : ${after.item.name}`, description: after.period.label, start: after.period.startDate, end: after.period.endDate }),
      ],
    }).catch((e) => console.error("mail", e));
    if (actor.type === "school")
      await notifyAdmins(`Réservation décalée : ${after.item.name}`, [
        ["École", after.school.name || after.school.email || "—"],
        ["Mallette", after.item.name],
        ["Avant", `${before.period.label} (${before.period.schoolYear})`],
        ["Après", `${after.period.label} (${after.period.schoolYear})`],
      ]);
  }
  return after;
}

export async function cancelReservation(input: { reservationId: string; actor: Actor }) {
  const settings = await getSettings();
  const full = await loadFull(input.reservationId);
  if (!full) throw new BookingError("Réservation introuvable.");
  const { actor } = input;
  if (!ACTIVE.includes(full.r.status as (typeof ACTIVE)[number])) throw new BookingError("Cette réservation n'est plus active.");
  if (actor.type === "school") {
    if (full.r.schoolId !== actor.schoolId) throw new BookingError("Cette réservation ne vous appartient pas.");
    if (full.r.status === "confirmed" && periodState(full.period) !== "upcoming")
      throw new BookingError("La période a déjà commencé : contactez le gestionnaire pour annuler.");
  }
  await db
    .update(schema.reservations)
    .set({ status: "cancelled", confirmTokenHash: null, updatedAt: new Date() })
    .where(eq(schema.reservations.id, full.r.id));
  await cancelConventions([full.r.id]);
  await audit(actor, "réservation annulée", full.r.id);

  if (full.r.status === "confirmed") {
    const { html, text } = renderMail({
      appName: settings.appName,
      title: "Réservation annulée",
      blocks: [
        { kind: "p", text: actor.type === "admin" ? "Le gestionnaire a annulé la réservation suivante." : "Votre réservation a bien été annulée." },
        { kind: "facts", rows: [["Mallette", full.item.name], ...periodFacts(full.period)] },
      ],
    });
    await sendMail({ to: full.school.email ?? [], subject: `Réservation annulée : ${full.item.name}`, html, text }).catch((e) => console.error("mail", e));
    if (actor.type === "school")
      await notifyAdmins(`Réservation annulée : ${full.item.name}`, [
        ["École", full.school.name || full.school.email || "—"],
        ["Mallette", full.item.name],
        ...periodFacts(full.period),
      ]);
  }
}

/** Renvoie un nouveau lien de confirmation (sans prolonger le délai). */
export async function resendConfirmation(input: { reservationId: string; schoolId: string }) {
  const settings = await getSettings();
  const full = await loadFull(input.reservationId);
  if (!full || full.r.schoolId !== input.schoolId || full.r.status !== "pending") throw new BookingError("Réservation introuvable.");
  if (full.r.expiresAt && full.r.expiresAt < new Date()) {
    await expireStalePending();
    throw new BookingError("Le délai de confirmation est dépassé.");
  }
  const { token, hash } = newToken();
  await db.update(schema.reservations).set({ confirmTokenHash: hash }).where(eq(schema.reservations.id, full.r.id));
  const url = `${appUrl()}/confirmer/${token}`;
  const { html, text } = renderMail({
    appName: settings.appName,
    title: "Confirmez votre réservation",
    blocks: [{ kind: "facts", rows: [["Mallette", full.item.name], ...periodFacts(full.period)] }],
    button: { label: "Confirmer la réservation", url },
  });
  await sendMail({ to: full.school.email ?? [], subject: `À confirmer : ${full.item.name} — ${full.period.label}`, html, text });
  return { confirmUrl: url };
}

/** Réservation directe par l'admin (confirmée d'office). */
export async function adminCreateReservation(input: { schoolId: string; itemId: string; periodId: string; adminEmail: string }) {
  await expireStalePending();
  let r: Reservation;
  let conventionId: string;
  try {
    ({ r, conventionId } = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.reservations)
        .values({ itemId: input.itemId, periodId: input.periodId, schoolId: input.schoolId, status: "confirmed", confirmedAt: new Date() })
        .returning();
      // Convention pré-remplie, à signer en ligne par la direction de l'école.
      const c = await createConvention(tx, { reservationId: row.id, sign: null });
      return { r: row, conventionId: c.id };
    }));
  } catch (e) {
    if (isUniqueViolation(e)) throw new BookingError("Cette mallette est déjà réservée sur cette période.");
    throw e;
  }
  await audit({ type: "admin", email: input.adminEmail }, "réservation créée par l'admin", r.id);
  const full = (await loadFull(r.id))!;
  const settings = await getSettings();
  const { html, text } = renderMail({
    appName: settings.appName,
    title: "Une mallette est réservée pour votre école",
    blocks: [
      { kind: "p", text: `Le gestionnaire a réservé « ${full.item.name} » pour votre école. Il reste à accepter la convention de prêt en ligne.` },
      { kind: "facts", rows: [["Mallette", full.item.name], ...periodFacts(full.period), ["Livraison", full.school.address || "—"]] },
    ],
    button: { label: "Lire et signer la convention", url: `${appUrl()}/conventions/${conventionId}` },
  });
  await sendMail({
    to: full.school.email ?? [],
    subject: `Convention à signer : ${full.item.name} — ${full.period.label}`,
    html,
    text,
    attachments: [icsEvent({ uid: `${r.id}@mallettes`, title: `Mallette : ${full.item.name}`, description: full.period.label, start: full.period.startDate, end: full.period.endDate })],
  }).catch((e) => console.error("mail", e));
  return r;
}

/* ------------------------------------------------------------------ */
/* Lectures pour l'interface                                           */
/* ------------------------------------------------------------------ */

export type SlotInfo = {
  reservationId: string;
  status: "pending" | "confirmed";
  schoolId: string;
  schoolName: string;
  conventionId: string | null;
  conventionStatus: "to_sign" | "signed" | "cancelled" | null;
};

export async function schoolYears(zone: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ y: schema.periods.schoolYear })
    .from(schema.periods)
    .where(eq(schema.periods.zone, zone))
    .orderBy(asc(schema.periods.schoolYear));
  return rows.map((r) => r.y);
}

export async function getPlanning(opts: { zone: string; schoolYear: string; includeInactive?: boolean }) {
  const periodsRows = await db
    .select()
    .from(schema.periods)
    .where(and(eq(schema.periods.zone, opts.zone), eq(schema.periods.schoolYear, opts.schoolYear)))
    .orderBy(asc(schema.periods.startDate));
  const itemRows = await db
    .select()
    .from(schema.items)
    .where(opts.includeInactive ? undefined : eq(schema.items.active, true))
    .orderBy(asc(schema.items.sortOrder), asc(schema.items.name));
  const slots = new Map<string, SlotInfo>();
  if (periodsRows.length) {
    const res = await db
      .select({
        r: schema.reservations,
        schoolName: schema.schools.name,
        schoolEmail: schema.schools.email,
        conventionId: schema.conventions.id,
        conventionStatus: schema.conventions.status,
      })
      .from(schema.reservations)
      .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
      .leftJoin(schema.conventions, eq(schema.conventions.reservationId, schema.reservations.id))
      .where(
        and(
          inArray(schema.reservations.periodId, periodsRows.map((p) => p.id)),
          or(
            eq(schema.reservations.status, "confirmed"),
            and(eq(schema.reservations.status, "pending"), gt(schema.reservations.expiresAt, new Date())),
          ),
        ),
      );
    for (const { r, schoolName, schoolEmail, conventionId, conventionStatus } of res)
      slots.set(`${r.itemId}:${r.periodId}`, {
        reservationId: r.id,
        status: r.status as "pending" | "confirmed",
        schoolId: r.schoolId,
        schoolName: schoolName || schoolEmail || "École",
        conventionId,
        conventionStatus,
      });
  }
  return { periods: periodsRows, items: itemRows, slots };
}

export async function defaultSchoolYear(zone: string): Promise<string | null> {
  const years = await schoolYears(zone);
  if (!years.length) return null;
  const today = todayParis();
  const [cur] = await db
    .select({ y: schema.periods.schoolYear })
    .from(schema.periods)
    .where(and(eq(schema.periods.zone, zone), sql`${schema.periods.endDate} >= ${today}`))
    .orderBy(asc(schema.periods.startDate))
    .limit(1);
  return cur?.y ?? years[years.length - 1];
}

export async function schoolReservations(schoolId: string) {
  return db
    .select({ r: schema.reservations, item: schema.items, period: schema.periods, convention: schema.conventions })
    .from(schema.reservations)
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.reservations.periodId))
    .leftJoin(schema.conventions, eq(schema.conventions.reservationId, schema.reservations.id))
    .where(and(eq(schema.reservations.schoolId, schoolId), inArray(schema.reservations.status, ["pending", "confirmed"])))
    .orderBy(asc(schema.periods.startDate));
}

/** Périodes non terminées + créneaux occupés, pour les dialogues de décalage. */
export async function moveOptions(zone: string, excludeReservationId?: string) {
  const today = todayParis();
  const periodsRows = await db
    .select()
    .from(schema.periods)
    .where(and(eq(schema.periods.zone, zone), sql`${schema.periods.endDate} >= ${today}`))
    .orderBy(asc(schema.periods.startDate));
  const res = periodsRows.length
    ? await db
        .select({ id: schema.reservations.id, itemId: schema.reservations.itemId, periodId: schema.reservations.periodId })
        .from(schema.reservations)
        .where(
          and(
            inArray(schema.reservations.periodId, periodsRows.map((p) => p.id)),
            or(
              eq(schema.reservations.status, "confirmed"),
              and(eq(schema.reservations.status, "pending"), gt(schema.reservations.expiresAt, new Date())),
            ),
          ),
        )
    : [];
  const occupied = res.filter((r) => r.id !== excludeReservationId).map((r) => `${r.itemId}:${r.periodId}`);
  return { periods: periodsRows, occupied };
}
