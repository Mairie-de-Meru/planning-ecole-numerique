"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { consumeLoginToken, createLoginToken, currentUser, logout, schoolProfileComplete } from "@/lib/auth";
import { isAllowed, isValidEmail, normalizeEmail } from "@/lib/allowlist";
import { renderMail, sendMail, testMode } from "@/lib/mail";
import { appUrl, getSettings } from "@/lib/settings";
import {
  BookingError,
  bookReservation,
  cancelReservation,
  confirmReservation,
  moveReservation,
  resendConfirmation,
} from "@/lib/reservations";
import {
  activeTemplate,
  conventionVars,
  getConvention,
  sendConventionEmail,
  signConvention,
  type SignInput,
} from "@/lib/conventions";
import { fillTemplate, toHtml } from "@/lib/convention-doc";

export type ActionResult = { ok: boolean; message: string; link?: string } | null;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || null;
}

function fail(e: unknown): ActionResult {
  // ConventionError hérite de BookingError : message affiché tel quel
  if (e instanceof BookingError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: "Une erreur inattendue est survenue. Réessayez dans un instant." };
}

/* ---------------- Connexion ---------------- */

export async function requestLoginAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!isValidEmail(email)) return { ok: false, message: "Adresse e-mail invalide." };
  if (!(await isAllowed(email)))
    return {
      ok: false,
      message: "Cette adresse n'est pas autorisée. Utilisez l'adresse officielle de votre école ou contactez le gestionnaire.",
    };
  const settings = await getSettings();
  const token = await createLoginToken(email);
  const url = `${appUrl()}/connexion/verifier?token=${encodeURIComponent(token)}`;
  const { html, text } = renderMail({
    appName: settings.appName,
    title: "Votre lien de connexion",
    blocks: [
      { kind: "p", text: "Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 20 minutes et ne peut servir qu'une fois." },
      { kind: "note", text: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail." },
    ],
    button: { label: "Me connecter", url },
  });
  try {
    await sendMail({ to: email, subject: `Connexion — ${settings.appName}`, html, text });
  } catch {
    return { ok: false, message: "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant." };
  }
  return { ok: true, message: email, link: testMode() ? url : undefined };
}

export async function consumeLoginAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  const email = await consumeLoginToken(token);
  if (!email) redirect("/connexion?erreur=lien");
  const { isAdmin } = await import("@/lib/settings");
  redirect((await isAdmin(email)) ? "/admin" : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/connexion");
}

/* ---------------- Fiche école ---------------- */

export async function saveProfileAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const values = {
    name: String(form.get("name") ?? "").trim(),
    address: String(form.get("address") ?? "").trim(),
    contactName: String(form.get("contactName") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    directorName: String(form.get("directorName") ?? "").trim(),
    directorTitle: String(form.get("directorTitle") ?? "Directrice").trim(),
  };
  if (!values.name || !values.address) return { ok: false, message: "Le nom de l'école et l'adresse de livraison sont obligatoires." };
  if (!values.directorName) return { ok: false, message: "Indiquez le nom du directeur ou de la directrice (signataire des conventions)." };
  const claimId = String(form.get("claimId") ?? "");
  if (user.school) {
    await db.update(schema.schools).set(values).where(eq(schema.schools.id, user.school.id));
  } else if (claimId) {
    // Rattachement à une fiche pré-remplie par le gestionnaire (encore sans adresse e-mail).
    const done = await db
      .update(schema.schools)
      .set({ ...values, email: user.email })
      .where(and(eq(schema.schools.id, claimId), isNull(schema.schools.email)))
      .returning({ id: schema.schools.id });
    if (!done.length) return { ok: false, message: "Cette école est déjà rattachée à une autre adresse. Contactez le gestionnaire." };
  } else {
    await db.insert(schema.schools).values({ email: user.email, ...values });
  }
  revalidatePath("/", "layout");
  if (form.get("first") === "1") redirect("/");
  return { ok: true, message: "Fiche enregistrée." };
}

/* ---------------- Réservations ---------------- */

async function requireSchool() {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  if (!schoolProfileComplete(user.school)) redirect("/mon-ecole?premiere=1");
  return { user, school: user.school! };
}

export async function bookAction(itemId: string, periodId: string, sign: SignInput): Promise<ActionResult> {
  const { user, school } = await requireSchool();
  try {
    const { confirmUrl } = await bookReservation({ schoolId: school.id, itemId, periodId, actorEmail: user.email, sign, ip: await clientIp() });
    // Le signataire est mémorisé pour pré-remplir les prochaines conventions.
    await db
      .update(schema.schools)
      .set({ directorName: sign.signerName.trim(), directorTitle: sign.signerTitle.trim() })
      .where(eq(schema.schools.id, school.id));
    revalidatePath("/");
    return { ok: true, message: user.email, link: testMode() ? confirmUrl : undefined };
  } catch (e) {
    revalidatePath("/");
    return fail(e);
  }
}

export async function moveAction(reservationId: string, periodId: string): Promise<ActionResult> {
  const { user, school } = await requireSchool();
  try {
    await moveReservation({ reservationId, periodId, actor: { type: "school", schoolId: school.id, email: user.email } });
    revalidatePath("/");
    revalidatePath("/reservations");
    return { ok: true, message: "Réservation décalée. Un e-mail de confirmation vous a été envoyé." };
  } catch (e) {
    revalidatePath("/");
    return fail(e);
  }
}

export async function cancelAction(reservationId: string): Promise<ActionResult> {
  const { user, school } = await requireSchool();
  try {
    await cancelReservation({ reservationId, actor: { type: "school", schoolId: school.id, email: user.email } });
    revalidatePath("/");
    revalidatePath("/reservations");
    return { ok: true, message: "Réservation annulée." };
  } catch (e) {
    return fail(e);
  }
}

export async function resendAction(reservationId: string): Promise<ActionResult> {
  const { school } = await requireSchool();
  try {
    const { confirmUrl } = await resendConfirmation({ reservationId, schoolId: school.id });
    return { ok: true, message: "Nouvel e-mail de confirmation envoyé.", link: testMode() ? confirmUrl : undefined };
  } catch (e) {
    revalidatePath("/");
    return fail(e);
  }
}

export async function confirmAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    // Pas de revalidatePath ici : la page se réafficherait avec un jeton déjà consommé.
    const r = await confirmReservation(String(form.get("token") ?? ""));
    return { ok: true, message: `${r.item.name}|${r.period.label}|${r.period.startDate}|${r.period.endDate}` };
  } catch (e) {
    return fail(e);
  }
}

export async function moveOptionsAction(reservationId: string) {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const settings = await getSettings();
  const { moveOptions } = await import("@/lib/reservations");
  const { periodState } = await import("@/lib/dates");
  const { periods, occupied } = await moveOptions(settings.zone, reservationId);
  return {
    periods: periods.map((p) => ({
      id: p.id,
      label: p.label,
      position: p.position,
      schoolYear: p.schoolYear,
      startDate: p.startDate,
      endDate: p.endDate,
      state: periodState(p),
    })),
    occupied,
  };
}

/* ---------------- Conventions ---------------- */

/** Convention pré-remplie affichée avant la réservation. */
export async function conventionPreviewAction(itemId: string, periodId: string) {
  const { school } = await requireSchool();
  const settings = await getSettings();
  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
  const [period] = await db.select().from(schema.periods).where(eq(schema.periods.id, periodId));
  if (!item || !period) return null;
  const t = await activeTemplate();
  const body = fillTemplate(t.body, conventionVars({ settings, school, item, period, signer: null }));
  return { html: toHtml(body), signerName: school.directorName, signerTitle: school.directorTitle };
}

async function ownConvention(id: string) {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  const c = await getConvention(id);
  if (!c) return { user, c: null };
  const allowed = user.admin || (user.school && user.school.id === c.school.id);
  return { user, c: allowed ? c : null };
}

export async function signConventionAction(conventionId: string, sign: SignInput): Promise<ActionResult> {
  const { user, c } = await ownConvention(conventionId);
  if (!c || !user.school) return { ok: false, message: "Convention introuvable." };
  try {
    await signConvention({ conventionId, schoolId: user.school.id, email: user.email, ip: await clientIp(), sign });
    await db
      .update(schema.schools)
      .set({ directorName: sign.signerName.trim(), directorTitle: sign.signerTitle.trim() })
      .where(eq(schema.schools.id, user.school.id));
    revalidatePath("/", "layout");
    return { ok: true, message: sign.emailCopy ? "Convention signée. Une copie PDF vous a été envoyée par e-mail." : "Convention signée." };
  } catch (e) {
    return fail(e);
  }
}

export async function sendConventionAction(conventionId: string): Promise<ActionResult> {
  const { c } = await ownConvention(conventionId);
  if (!c) return { ok: false, message: "Convention introuvable." };
  try {
    await sendConventionEmail(conventionId);
    return { ok: true, message: `Convention envoyée à ${c.school.email}.` };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- Fiche de prêt (lien) ---------------- */

export async function acceptSheetAction(token: string, step: "delivery" | "return", input: { accepted: boolean; name: string; signatureImage?: string | null }): Promise<ActionResult> {
  const { acceptSheetStep } = await import("@/lib/conventions");
  const user = await currentUser();
  try {
    await acceptSheetStep(token, step, input, !!user?.admin);
    revalidatePath(`/fiche/${token}`);
    return { ok: true, message: step === "delivery" ? "Remise confirmée. Merci !" : "Reprise confirmée. Merci !" };
  } catch (e) {
    return fail(e);
  }
}
