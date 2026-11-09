import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import type { Item, Period, School, Settings } from "@/db/schema";
import { BookingError } from "./errors";
import { DEFAULT_TEMPLATE, fillTemplate, toHtml, toPdf } from "./convention-doc";
import { frLong } from "./dates";
import { renderMail, sendMail, type MailAttachment } from "./mail";
import { appUrl, getSettings } from "./settings";
import { inventorySummary, parseInventory, toLoanSheet, type LoanLine } from "./inventory";

export class ConventionError extends BookingError {}

export type SignInput = {
  accepted: boolean;
  signerName: string;
  signerTitle: string;
  /** Lieu de stockage du matériel pendant le prêt (article 5). */
  storageLocation: string;
  signatureImage?: string | null;
  emailCopy: boolean;
};

const MAX_SIGNATURE = 500_000;

/** Contrôle la saisie du signataire ; renvoie la méthode de signature. */
export function validateSign(s: SignInput): "checkbox" | "drawn" {
  if (!s.accepted) throw new ConventionError("Cochez « J'ai lu et j'accepte la convention de prêt » pour réserver.");
  const name = s.signerName.trim();
  if (name.length < 3 || name.length > 120) throw new ConventionError("Indiquez le nom de la personne qui signe la convention.");
  if (!s.signerTitle.trim() || s.signerTitle.length > 80) throw new ConventionError("Indiquez la fonction du signataire.");
  if (!s.storageLocation?.trim() || s.storageLocation.length > 120) throw new ConventionError("Indiquez le lieu de stockage du matériel pendant le prêt.");
  if (s.signatureImage) {
    if (!s.signatureImage.startsWith("data:image/png;base64,") || s.signatureImage.length > MAX_SIGNATURE)
      throw new ConventionError("Signature illisible ou trop lourde : redessinez-la ou choisissez une autre image.");
    return "drawn";
  }
  return "checkbox";
}

export const METHOD_LABEL: Record<string, string> = {
  checkbox: "Acceptation par case à cocher",
  drawn: "Signature manuscrite numérique",
};

/* ------------------------------------------------------------------ */
/* Modèle                                                              */
/* ------------------------------------------------------------------ */

export async function activeTemplate(tx: Tx | typeof db = db): Promise<{ id: number; body: string; createdAt: Date; createdBy: string }> {
  const [t] = await tx.select().from(schema.conventionTemplates).orderBy(desc(schema.conventionTemplates.id)).limit(1);
  if (t) return t;
  const [created] = await tx.insert(schema.conventionTemplates).values({ body: DEFAULT_TEMPLATE, createdBy: "modèle par défaut" }).returning();
  return created;
}

async function templateBody(tx: Tx | typeof db, id: number | null): Promise<string> {
  if (id) {
    const [t] = await tx.select().from(schema.conventionTemplates).where(eq(schema.conventionTemplates.id, id));
    if (t) return t.body;
  }
  return (await activeTemplate(tx)).body;
}

function euros(n: number | null) {
  return n ? `${new Intl.NumberFormat("fr-FR").format(n)} €`.replace(/ /g, " ") : "non précisée";
}

export function conventionVars(opts: {
  settings: Settings;
  school: School;
  item: Item;
  period: Period;
  signer?: { name: string; title: string } | null;
  storage?: string | null;
}): Record<string, string> {
  const { settings, school, item, period } = opts;
  const presentation = item.contents.trim() || item.description.trim() || item.name;
  return {
    preteur: settings.lenderName,
    preteur_adresse: settings.lenderAddress,
    preteur_representant: settings.lenderRepresentative,
    service_informatique: settings.itService,
    contact_informatique: settings.itContact,
    ecole: school.name || "école",
    ecole_adresse: school.address.replace(/\s*\n\s*/g, ", ") || "adresse à compléter",
    signataire: opts.signer?.name || school.directorName || "la direction de l'école",
    fonction: opts.signer?.title || school.directorTitle || "directrice ou directeur",
    materiel: item.name,
    presentation: /[.!?]$/.test(presentation) ? presentation : `${presentation}.`,
    inventaire: inventorySummary(parseInventory(item.inventory)) || item.name,
    valeur: euros(item.replacementValue),
    periode: `période ${period.position} (${period.label.replace("→", "–")}) de l'année scolaire ${period.schoolYear}`,
    date_debut: frLong(period.startDate),
    date_fin: frLong(period.endDate),
    annee_scolaire: period.schoolYear,
    lieu_stockage: opts.storage?.trim() || "à préciser par l'école lors de la signature",
  };
}

async function loadParts(tx: Tx | typeof db, reservationId: string) {
  const [row] = await tx
    .select({ r: schema.reservations, item: schema.items, period: schema.periods, school: schema.schools })
    .from(schema.reservations)
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.reservations.periodId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
    .where(eq(schema.reservations.id, reservationId));
  if (!row) throw new ConventionError("Réservation introuvable.");
  return row;
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

/** Crée la convention d'une réservation, signée d'emblée si `sign` est fourni. */
export async function createConvention(
  tx: Tx,
  opts: { reservationId: string; sign?: (SignInput & { email: string; ip?: string | null }) | null },
) {
  // Tout passe par la transaction : pas de seconde connexion pendant qu'elle est ouverte.
  const [settings] = await tx.select().from(schema.settings).where(eq(schema.settings.id, 1));
  const parts = await loadParts(tx, opts.reservationId);
  const template = await activeTemplate(tx);
  const signer = opts.sign ? { name: opts.sign.signerName.trim(), title: opts.sign.signerTitle.trim() } : null;
  const storage = opts.sign?.storageLocation.trim() ?? null;
  const body = fillTemplate(template.body, conventionVars({ settings, ...parts, signer, storage }));
  const [c] = await tx
    .insert(schema.conventions)
    .values({
      reservationId: opts.reservationId,
      templateId: template.id,
      body,
      loanSheet: toLoanSheet(parts.item.inventory),
      storageLocation: storage,
      status: opts.sign ? "signed" : "to_sign",
      ...(opts.sign
        ? {
            signerName: signer!.name,
            signerTitle: signer!.title,
            signerEmail: opts.sign.email,
            signatureMethod: validateSign(opts.sign),
            signatureImage: opts.sign.signatureImage || null,
            signedAt: new Date(),
            signedIp: opts.sign.ip ?? null,
            emailCopy: opts.sign.emailCopy,
          }
        : {}),
    })
    .returning();
  return c;
}

/** Signature d'une convention en attente (réservation créée par le gestionnaire). */
export async function signConvention(opts: { conventionId: string; schoolId: string; email: string; ip?: string | null; sign: SignInput }) {
  const method = validateSign(opts.sign);
  const c = await getConvention(opts.conventionId);
  if (!c || c.school.id !== opts.schoolId) throw new ConventionError("Convention introuvable.");
  if (c.convention.status !== "to_sign") throw new ConventionError("Cette convention n'est plus à signer.");
  const settings = await getSettings();
  const signer = { name: opts.sign.signerName.trim(), title: opts.sign.signerTitle.trim() };
  const storage = opts.sign.storageLocation.trim();
  const body = fillTemplate(
    await templateBody(db, c.convention.templateId),
    conventionVars({ settings, school: c.school, item: c.item, period: c.period, signer, storage }),
  );
  await db
    .update(schema.conventions)
    .set({
      status: "signed",
      body,
      storageLocation: storage,
      signerName: signer.name,
      signerTitle: signer.title,
      signerEmail: opts.email,
      signatureMethod: method,
      signatureImage: opts.sign.signatureImage || null,
      signedAt: new Date(),
      signedIp: opts.ip ?? null,
      emailCopy: opts.sign.emailCopy,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.conventions.id, opts.conventionId), eq(schema.conventions.status, "to_sign")));
  if (opts.sign.emailCopy) await sendConventionEmail(opts.conventionId).catch((e) => console.error("mail", e));
}

/** Après un décalage : dates et matériel mis à jour, signature conservée, modification tracée. */
export async function updateConventionAfterMove(reservationId: string, note: string) {
  const [c] = await db.select().from(schema.conventions).where(eq(schema.conventions.reservationId, reservationId));
  if (!c || c.status === "cancelled") return;
  const settings = await getSettings();
  const parts = await loadParts(db, reservationId);
  const signer = c.signerName ? { name: c.signerName, title: c.signerTitle ?? "" } : null;
  const body = fillTemplate(await templateBody(db, c.templateId), conventionVars({ settings, ...parts, signer, storage: c.storageLocation }));
  const amendments = [...((c.amendments as { at: string; text: string }[]) ?? []), { at: new Date().toISOString(), text: note }];
  // Changement de mallette avant livraison : la fiche de prêt suit le nouveau matériel.
  const loanSheet = c.deliveredAt ? c.loanSheet : toLoanSheet(parts.item.inventory);
  await db.update(schema.conventions).set({ body, amendments, loanSheet, updatedAt: new Date() }).where(eq(schema.conventions.id, c.id));
}

/** Réservation annulée ou expirée : la convention est classée « annulée » (son texte est conservé). */
export async function cancelConventions(reservationIds: string[]) {
  if (!reservationIds.length) return;
  await db
    .update(schema.conventions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(inArray(schema.conventions.reservationId, reservationIds), inArray(schema.conventions.status, ["to_sign", "signed"])));
}

/* ------------------------------------------------------------------ */
/* Lecture, PDF, e-mail                                                */
/* ------------------------------------------------------------------ */

export async function getConvention(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ convention: schema.conventions, r: schema.reservations, item: schema.items, period: schema.periods, school: schema.schools })
    .from(schema.conventions)
    .innerJoin(schema.reservations, eq(schema.reservations.id, schema.conventions.reservationId))
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.reservations.periodId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
    .where(eq(schema.conventions.id, id));
  return row ?? null;
}

export async function getConventionByReservation(reservationId: string) {
  const [c] = await db.select({ id: schema.conventions.id }).from(schema.conventions).where(eq(schema.conventions.reservationId, reservationId));
  return c ? getConvention(c.id) : null;
}

export function conventionNumber(c: { number: number; createdAt: Date }) {
  return `${c.createdAt.getFullYear()}-${String(c.number).padStart(4, "0")}`;
}

export function formatStamp(d: Date) {
  return d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
}

export function amendmentsOf(c: { amendments: unknown }) {
  return ((c.amendments as { at: string; text: string }[]) ?? []).map((a) => ({ at: formatStamp(new Date(a.at)), text: a.text }));
}

export function conventionHtml(body: string) {
  return toHtml(body);
}

export async function conventionPdf(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const full = await getConvention(id);
  if (!full) return null;
  const settings = await getSettings();
  const c = full.convention;
  const number = conventionNumber(c);
  const buffer = await toPdf(c.body, {
    number,
    lender: settings.lenderName,
    lenderAddress: settings.lenderAddress,
    lenderSignatory: { name: settings.lenderSignatoryName, title: settings.lenderSignatoryTitle },
    school: full.school.name,
    item: full.item.name,
    loan: { from: frLong(full.period.startDate), to: frLong(full.period.endDate) },
    storage: c.storageLocation,
    sheet: (c.loanSheet as LoanLine[]) ?? [],
    delivery: c.deliveredAt ? { at: frLong(c.deliveredAt), by: c.deliveredBy ?? "", note: c.deliveryNote ?? "" } : null,
    returned: c.returnedAt ? { at: frLong(c.returnedAt), by: c.returnedBy ?? "", note: c.returnNote ?? "" } : null,
    appName: settings.appName,
    status: c.status,
    signer:
      c.signedAt && c.signerName
        ? {
            name: c.signerName,
            title: c.signerTitle ?? "",
            email: c.signerEmail ?? "",
            at: formatStamp(c.signedAt),
            method: METHOD_LABEL[c.signatureMethod ?? "checkbox"] ?? "",
            image: c.signatureImage,
          }
        : null,
    amendments: amendmentsOf(c),
  });
  const slug = full.school.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return { buffer, filename: `convention-${number}-${slug || "ecole"}.pdf` };
}

export async function conventionAttachment(id: string): Promise<MailAttachment | null> {
  const pdf = await conventionPdf(id);
  return pdf ? { filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" } : null;
}

/** Envoie la convention pré-remplie (PDF) à l'école. */
export async function sendConventionEmail(id: string) {
  const full = await getConvention(id);
  if (!full || !full.school.email) throw new ConventionError("Aucune adresse e-mail pour cette école.");
  const settings = await getSettings();
  const c = full.convention;
  const attachment = await conventionAttachment(id);
  const { html, text } = renderMail({
    appName: settings.appName,
    title: c.status === "signed" ? "Votre convention de prêt" : "Convention de prêt à signer",
    blocks: [
      {
        kind: "p",
        text:
          c.status === "signed"
            ? "Vous trouverez ci-joint la convention de prêt acceptée en ligne, au format PDF."
            : "Vous trouverez ci-joint la convention de prêt pré-remplie. Elle se signe en ligne en un clic.",
      },
      {
        kind: "facts",
        rows: [
          ["Convention", `n° ${conventionNumber(c)}`],
          ["Mallette", full.item.name],
          ["Période", `Période ${full.period.position} · ${full.period.schoolYear}`],
          ["Du", frLong(full.period.startDate)],
          ["Au", frLong(full.period.endDate)],
        ],
      },
    ],
    button: { label: c.status === "signed" ? "Voir la convention" : "Signer la convention", url: `${appUrl()}/conventions/${id}` },
  });
  await sendMail({
    to: full.school.email,
    subject: `Convention de prêt n° ${conventionNumber(c)} — ${full.item.name}`,
    html,
    text,
    attachments: attachment ? [attachment] : [],
  });
}

export async function listConventions() {
  return db
    .select({ convention: schema.conventions, item: schema.items, period: schema.periods, school: schema.schools })
    .from(schema.conventions)
    .innerJoin(schema.reservations, eq(schema.reservations.id, schema.conventions.reservationId))
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.periods, eq(schema.periods.id, schema.reservations.periodId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
    .orderBy(desc(schema.conventions.number));
}

/* ------------------------------------------------------------------ */
/* Fiche de prêt : remise et reprise (service informatique)            */
/* ------------------------------------------------------------------ */

export type HandoverInput = { at: string; by: string; note: string; states: string[] };

function checkHandover(h: HandoverInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.at)) throw new ConventionError("Date invalide.");
  if (!h.by.trim()) throw new ConventionError("Indiquez qui a effectué l'opération.");
}

export async function recordDelivery(conventionId: string, h: HandoverInput) {
  checkHandover(h);
  const [c] = await db.select().from(schema.conventions).where(eq(schema.conventions.id, conventionId));
  if (!c || c.status === "cancelled") throw new ConventionError("Convention introuvable ou annulée.");
  const sheet = ((c.loanSheet as LoanLine[]) ?? []).map((l, i) => ({ ...l, stateOut: h.states[i] || l.state || null }));
  await db
    .update(schema.conventions)
    .set({ loanSheet: sheet, deliveredAt: h.at, deliveredBy: h.by.trim(), deliveryNote: h.note.trim(), updatedAt: new Date() })
    .where(eq(schema.conventions.id, conventionId));
}

/** Reprise : enregistre l'état au retour et met à jour l'inventaire de la mallette. */
export async function recordReturn(conventionId: string, h: HandoverInput) {
  checkHandover(h);
  const full = await getConvention(conventionId);
  if (!full) throw new ConventionError("Convention introuvable.");
  const c = full.convention;
  if (!c.deliveredAt) throw new ConventionError("Enregistrez d'abord la remise du matériel.");
  if (h.at < c.deliveredAt) throw new ConventionError("La date de reprise précède la date de remise.");
  const sheet = ((c.loanSheet as LoanLine[]) ?? []).map((l, i) => ({ ...l, stateIn: h.states[i] || l.stateOut || null }));
  await db.transaction(async (tx) => {
    await tx
      .update(schema.conventions)
      .set({ loanSheet: sheet, returnedAt: h.at, returnedBy: h.by.trim(), returnNote: h.note.trim(), updatedAt: new Date() })
      .where(eq(schema.conventions.id, conventionId));
    // L'état constaté à la reprise devient l'état courant du matériel (ligne retrouvée par n° de série ou désignation).
    const current = parseInventory(full.item.inventory);
    const updated = current.map((line) => {
      const found = sheet.find((s) => (line.serial ? s.serial === line.serial : s.label === line.label));
      return found?.stateIn ? { ...line, state: found.stateIn } : line;
    });
    const { formatInventory } = await import("./inventory");
    await tx.update(schema.items).set({ inventory: formatInventory(updated) }).where(eq(schema.items.id, full.item.id));
  });
}
