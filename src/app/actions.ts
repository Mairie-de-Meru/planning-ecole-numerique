"use server";

import { revalidatePath } from "next/cache";
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

export type ActionResult = { ok: boolean; message: string; link?: string } | null;

function fail(e: unknown): ActionResult {
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
  };
  if (!values.name || !values.address) return { ok: false, message: "Le nom de l'école et l'adresse de livraison sont obligatoires." };
  await db
    .insert(schema.schools)
    .values({ email: user.email, ...values })
    .onConflictDoUpdate({ target: schema.schools.email, set: values });
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

export async function bookAction(itemId: string, periodId: string): Promise<ActionResult> {
  const { user, school } = await requireSchool();
  try {
    const { confirmUrl } = await bookReservation({ schoolId: school.id, itemId, periodId, actorEmail: user.email });
    revalidatePath("/");
    return { ok: true, message: school.email, link: testMode() ? confirmUrl : undefined };
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
