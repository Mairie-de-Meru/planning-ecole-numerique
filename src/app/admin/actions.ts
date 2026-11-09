"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeEmail, isValidEmail } from "@/lib/allowlist";
import { BookingError, adminCreateReservation, cancelReservation, moveReservation } from "@/lib/reservations";
import { applyProposal, rejectProposal, runSync } from "@/lib/periods/sync";
import { getSettings, updateSettings } from "@/lib/settings";
import type { ActionResult } from "../actions";

function fail(e: unknown): ActionResult {
  if (e instanceof BookingError || e instanceof Error) return { ok: false, message: e.message };
  return { ok: false, message: "Erreur inattendue." };
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Réservations ---------------- */

export async function adminCreateAction(schoolId: string, itemId: string, periodId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    if (!schoolId) return { ok: false, message: "Choisissez une école." };
    await adminCreateReservation({ schoolId, itemId, periodId, adminEmail: admin.email });
    refresh();
    return { ok: true, message: "Réservation créée. L'école a été prévenue par e-mail." };
  } catch (e) {
    return fail(e);
  }
}

export async function adminMoveAction(reservationId: string, periodId: string, itemId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await moveReservation({ reservationId, periodId, itemId, actor: { type: "admin", email: admin.email } });
    refresh();
    return { ok: true, message: "Réservation modifiée. L'école a été prévenue par e-mail." };
  } catch (e) {
    return fail(e);
  }
}

export async function adminCancelAction(reservationId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await cancelReservation({ reservationId, actor: { type: "admin", email: admin.email } });
    refresh();
    return { ok: true, message: "Réservation annulée. L'école a été prévenue par e-mail." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Mallettes ---------------- */

export async function saveItemAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const values = {
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    contents: String(form.get("contents") ?? "").trim(),
    sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
    color: String(form.get("color") ?? "") || null,
    inventory: String(form.get("inventory") ?? "").trim(),
    replacementValue: Number(form.get("replacementValue")) > 0 ? Math.round(Number(form.get("replacementValue"))) : null,
    active: form.get("active") === "on",
  };
  if (!values.name) return { ok: false, message: "Le nom est obligatoire." };

  const file = form.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (photo) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
      return { ok: false, message: "Photo : formats acceptés JPG, PNG ou WebP." };
    if (photo.size > 3 * 1024 * 1024) return { ok: false, message: "Photo trop lourde (3 Mo maximum)." };
  }

  let itemId = id;
  if (id) await db.update(schema.items).set(values).where(eq(schema.items.id, id));
  else [{ id: itemId }] = await db.insert(schema.items).values(values).returning({ id: schema.items.id });

  if (photo) {
    const data = Buffer.from(await photo.arrayBuffer());
    const now = new Date();
    await db
      .insert(schema.itemPhotos)
      .values({ itemId, mime: photo.type, data, updatedAt: now })
      .onConflictDoUpdate({ target: schema.itemPhotos.itemId, set: { mime: photo.type, data, updatedAt: now } });
    await db.update(schema.items).set({ photoUrl: `/photos/${itemId}?v=${now.getTime()}` }).where(eq(schema.items.id, itemId));
  } else if (form.get("removePhoto") === "on") {
    await db.delete(schema.itemPhotos).where(eq(schema.itemPhotos.itemId, itemId));
    await db.update(schema.items).set({ photoUrl: null }).where(eq(schema.items.id, itemId));
  }
  refresh();
  return { ok: true, message: id ? "Mallette mise à jour." : "Mallette ajoutée." };
}

export async function deleteItemAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const [used] = await db.select({ id: schema.reservations.id }).from(schema.reservations).where(eq(schema.reservations.itemId, id)).limit(1);
  // Une mallette avec un historique est seulement désactivée.
  if (used) await db.update(schema.items).set({ active: false }).where(eq(schema.items.id, id));
  else await db.delete(schema.items).where(eq(schema.items.id, id));
  refresh();
}

/* ---------------- Périodes ---------------- */

export async function savePeriodAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const settings = await getSettings();
  const id = String(form.get("id") ?? "");
  const values = {
    label: String(form.get("label") ?? "").trim(),
    schoolYear: String(form.get("schoolYear") ?? "").trim(),
    position: Number(form.get("position") ?? 0),
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    locked: form.get("locked") === "on",
  };
  if (!values.label || !/^\d{4}-\d{4}$/.test(values.schoolYear) || !values.startDate || !values.endDate)
    return { ok: false, message: "Tous les champs sont obligatoires (année au format 2026-2027)." };
  if (values.endDate < values.startDate) return { ok: false, message: "La date de fin précède la date de début." };
  if (!(values.position >= 1 && values.position <= 9)) return { ok: false, message: "Position entre 1 et 9." };
  try {
    if (id) await db.update(schema.periods).set({ ...values, source: "manual", updatedAt: new Date() }).where(eq(schema.periods.id, id));
    else await db.insert(schema.periods).values({ ...values, zone: settings.zone, source: "manual" });
  } catch {
    return { ok: false, message: "Une période existe déjà à cette position pour cette année." };
  }
  refresh();
  return { ok: true, message: id ? "Période mise à jour." : "Période ajoutée." };
}

export async function toggleLockAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const [p] = await db.select().from(schema.periods).where(eq(schema.periods.id, id));
  if (p) await db.update(schema.periods).set({ locked: !p.locked }).where(eq(schema.periods.id, id));
  refresh();
}

export async function deletePeriodAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(form.get("id"));
  const [used] = await db
    .select({ id: schema.reservations.id })
    .from(schema.reservations)
    .where(and(eq(schema.reservations.periodId, id), inArray(schema.reservations.status, ["pending", "confirmed"])))
    .limit(1);
  if (used) return { ok: false, message: "Impossible : des réservations actives existent sur cette période. Déplacez-les ou annulez-les d'abord." };
  await db.delete(schema.reservations).where(eq(schema.reservations.periodId, id));
  await db.delete(schema.periods).where(eq(schema.periods.id, id));
  refresh();
  return { ok: true, message: "Période supprimée." };
}

export async function syncNowAction(): Promise<ActionResult> {
  await requireAdmin();
  const r = await runSync();
  refresh();
  return { ok: r.ok, message: r.message };
}

export async function applyProposalAction(form: FormData) {
  await requireAdmin();
  await applyProposal(String(form.get("id")));
  refresh();
}

export async function rejectProposalAction(form: FormData) {
  await requireAdmin();
  await rejectProposal(String(form.get("id")));
  refresh();
}

/* ---------------- Écoles & liste blanche ---------------- */

export async function addAllowlistAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = String(form.get("patterns") ?? "");
  const patterns = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const bad = patterns.filter((p) => !(p.startsWith("@") ? /^@[^\s@]+\.[^\s@]+$/.test(p) : isValidEmail(p)));
  if (!patterns.length) return { ok: false, message: "Saisissez au moins une adresse ou un domaine." };
  if (bad.length) return { ok: false, message: `Format non reconnu : ${bad.join(", ")} (ex. ecole@exemple.fr ou @ac-amiens.fr)` };
  await db.insert(schema.allowlist).values(patterns.map((pattern) => ({ pattern }))).onConflictDoNothing();
  refresh();
  return { ok: true, message: `${patterns.length} entrée(s) ajoutée(s).` };
}

export async function removeAllowlistAction(form: FormData) {
  await requireAdmin();
  await db.delete(schema.allowlist).where(eq(schema.allowlist.id, String(form.get("id"))));
  refresh();
}

export async function saveSchoolAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const rawEmail = normalizeEmail(String(form.get("email") ?? ""));
  const email = rawEmail || null;
  const values = {
    name: String(form.get("name") ?? "").trim(),
    address: String(form.get("address") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    directorName: String(form.get("directorName") ?? "").trim(),
    directorTitle: String(form.get("directorTitle") ?? "").trim() || "Directrice",
  };
  if (!values.name) return { ok: false, message: "Le nom de l'école est obligatoire." };
  if (email && !isValidEmail(email)) return { ok: false, message: "Adresse e-mail invalide." };
  try {
    if (id) await db.update(schema.schools).set({ ...values, email }).where(eq(schema.schools.id, id));
    else await db.insert(schema.schools).values({ ...values, email });
  } catch {
    return { ok: false, message: "Une école utilise déjà cette adresse e-mail." };
  }
  refresh();
  return { ok: true, message: id ? "École mise à jour." : "École ajoutée." };
}

/* ---------------- Conventions ---------------- */

export async function saveTemplateAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const body = String(form.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (body.length < 200) return { ok: false, message: "Le modèle semble incomplet." };
  const { activeTemplate } = await import("@/lib/conventions");
  const current = await activeTemplate();
  if (current.body.trim() === body) return { ok: true, message: "Aucune modification." };
  await db.insert(schema.conventionTemplates).values({ body, createdBy: admin.email });
  refresh();
  return { ok: true, message: "Nouvelle version du modèle enregistrée. Elle s'applique aux prochaines conventions ; les conventions déjà signées ne changent pas." };
}

export async function resetTemplateAction() {
  const admin = await requireAdmin();
  const { DEFAULT_TEMPLATE } = await import("@/lib/convention-doc");
  await db.insert(schema.conventionTemplates).values({ body: DEFAULT_TEMPLATE, createdBy: `${admin.email} (modèle par défaut)` });
  refresh();
}

export async function saveLenderAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const v = {
    lenderName: String(form.get("lenderName") ?? "").trim(),
    lenderAddress: String(form.get("lenderAddress") ?? "").trim(),
    lenderRepresentative: String(form.get("lenderRepresentative") ?? "").trim(),
    lenderSignatoryName: String(form.get("lenderSignatoryName") ?? "").trim(),
    lenderSignatoryTitle: String(form.get("lenderSignatoryTitle") ?? "").trim(),
    itService: String(form.get("itService") ?? "").trim(),
    itContact: String(form.get("itContact") ?? "").trim(),
  };
  if (!v.lenderName || !v.itService) return { ok: false, message: "Le prêteur et le service chargé de la livraison sont obligatoires." };
  await updateSettings(v);
  refresh();
  return { ok: true, message: "Informations enregistrées." };
}

/* ---------------- Réglages ---------------- */

export async function saveSettingsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const zone = String(form.get("zone") ?? "B").toUpperCase();
  const ttl = Number(form.get("confirmTtlMinutes"));
  const max = Number(form.get("maxPerSchoolPerPeriod"));
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  if (!["A", "B", "C"].includes(zone)) return { ok: false, message: "Zone invalide." };
  if (!(ttl >= 5 && ttl <= 1440)) return { ok: false, message: "Délai de confirmation entre 5 et 1440 minutes." };
  if (!(max >= 0 && max <= 50)) return { ok: false, message: "Plafond entre 0 (illimité) et 50." };
  if (!/^https?:\/\//.test(sourceUrl)) return { ok: false, message: "Adresse de la source invalide." };
  await updateSettings({
    appName: String(form.get("appName") ?? "").trim() || "Mallettes pédagogiques",
    zone,
    sourceUrl,
    syncEnabled: form.get("syncEnabled") === "on",
    confirmTtlMinutes: ttl,
    maxPerSchoolPerPeriod: max,
    notifyAdmin: form.get("notifyAdmin") === "on",
    splitJune: form.get("splitJune") === "on",
  });
  refresh();
  return { ok: true, message: "Réglages enregistrés." };
}

export async function addAdminAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!isValidEmail(email)) return { ok: false, message: "Adresse invalide." };
  await db.insert(schema.admins).values({ email }).onConflictDoNothing();
  refresh();
  return { ok: true, message: `${email} est maintenant administrateur.` };
}

export async function removeAdminAction(form: FormData) {
  const me = await requireAdmin();
  const email = String(form.get("email"));
  if (email !== me.email) await db.delete(schema.admins).where(eq(schema.admins.email, email));
  refresh();
}

/* ---------------- Fiche de prêt ---------------- */

function handoverFrom(form: FormData) {
  const n = Number(form.get("lines") ?? 0);
  return {
    at: String(form.get("at") ?? ""),
    by: String(form.get("by") ?? ""),
    note: String(form.get("note") ?? ""),
    states: Array.from({ length: n }, (_, i) => String(form.get(`state-${i}`) ?? "")),
  };
}

async function maybeSend(form: FormData, done: string): Promise<ActionResult> {
  if (form.get("send") !== "on") return { ok: true, message: done };
  const { sendLoanSheet } = await import("@/lib/conventions");
  const { testMode } = await import("@/lib/mail");
  try {
    const r = await sendLoanSheet(String(form.get("id")));
    return { ok: true, message: `${done} Fiche envoyée à ${r.to} pour confirmation.`, link: testMode() ? r.url : undefined };
  } catch (e) {
    return { ok: true, message: `${done} ${e instanceof Error ? e.message : ""}` };
  }
}

export async function sendLoanSheetAction(conventionId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { sendLoanSheet } = await import("@/lib/conventions");
    const { testMode } = await import("@/lib/mail");
    const r = await sendLoanSheet(conventionId);
    return { ok: true, message: `Fiche de prêt envoyée à ${r.to}.`, link: testMode() ? r.url : undefined };
  } catch (e) {
    return fail(e);
  }
}

/** Ouvre la fiche pour la faire accepter sur place (tablette du service informatique). */
export async function sheetLinkAction(conventionId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { issueSheetLink } = await import("@/lib/conventions");
    return { ok: true, message: "", link: await issueSheetLink(conventionId) };
  } catch (e) {
    return fail(e);
  }
}

export async function recordDeliveryAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { recordDelivery } = await import("@/lib/conventions");
    await recordDelivery(String(form.get("id")), handoverFrom(form));
    refresh();
    return maybeSend(form, "Remise enregistrée sur la fiche de prêt.");
  } catch (e) {
    return fail(e);
  }
}

export async function recordReturnAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { recordReturn } = await import("@/lib/conventions");
    await recordReturn(String(form.get("id")), handoverFrom(form));
    refresh();
    return maybeSend(form, "Reprise enregistrée. L'inventaire de la mallette a été mis à jour.");
  } catch (e) {
    return fail(e);
  }
}
