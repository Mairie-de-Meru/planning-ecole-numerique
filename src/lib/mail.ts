import nodemailer from "nodemailer";
import { addDays, frLong } from "./dates";

export type MailAttachment = { filename: string; content: string; contentType: string };
export type Mail = { to: string | string[]; subject: string; html: string; text: string; attachments?: MailAttachment[] };

export function smtpConfigured() {
  return !!process.env.SMTP_HOST;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Envoie un e-mail et l'inscrit au journal.
 * Sans SMTP configuré (mode test), l'e-mail n'est pas envoyé : il est seulement
 * visible dans le journal de l'espace admin et dans la console.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
  if (to.length === 0) return;
  const { db, schema } = await import("@/db");
  const log = (delivered: boolean, error?: string) =>
    db
      .insert(schema.mailLog)
      .values({ to: to.join(", "), subject: mail.subject, text: mail.text, html: mail.html, delivered, error })
      .catch((e) => console.error("mail_log", e));

  if (!smtpConfigured()) {
    console.log(`\n✉️  [mode test — SMTP non configuré] À: ${to.join(", ")}\n   Objet: ${mail.subject}\n${mail.text}\n`);
    await log(false, "SMTP non configuré (mode test)");
    return;
  }
  try {
    await transport().sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: to.join(", "),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    });
    await log(true);
  } catch (e) {
    await log(false, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Gabarit                                                             */
/* ------------------------------------------------------------------ */

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Block = { kind: "p"; text: string } | { kind: "facts"; rows: [string, string][] } | { kind: "note"; text: string };

export function renderMail(opts: {
  appName: string;
  title: string;
  blocks: Block[];
  button?: { label: string; url: string };
}): { html: string; text: string } {
  const accent = "#2f5bd3";
  const body = opts.blocks
    .map((b) => {
      if (b.kind === "p")
        return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155">${esc(b.text)}</p>`;
      if (b.kind === "note")
        return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b">${esc(b.text)}</p>`;
      return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 20px;background:#f3efe5;border-radius:12px">${b.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 16px;font-size:13px;color:#64748b;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:10px 16px;font-size:14px;color:#0f172a;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`;
    })
    .join("");
  const button = opts.button
    ? `<p style="margin:24px 0 8px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:12px">${esc(opts.button.label)}</a></p>
       <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;word-break:break-all">Ou copiez ce lien : ${esc(opts.button.url)}</p>`
    : "";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f8f5ee;font-family:Nunito,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#fffefb;border:2px solid #e8e2d4;border-radius:20px;padding:32px;border-top:6px solid ${accent}">
<tr><td>
<p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:.02em;color:${accent}">${esc(opts.appName)}</p>
<h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:#1d2742"><span style="background:linear-gradient(transparent 58%,#ffe680 58%,#ffe680 92%,transparent 92%)">${esc(opts.title)}</span></h1>
${body}${button}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">E-mail automatique — merci de ne pas y répondre.</p>
</td></tr></table></body></html>`;

  const text = [
    opts.title,
    "",
    ...opts.blocks.map((b) =>
      b.kind === "facts" ? b.rows.map(([k, v]) => `${k} : ${v}`).join("\n") : b.text,
    ),
    opts.button ? `\n${opts.button.label} : ${opts.button.url}` : "",
  ].join("\n\n");
  return { html, text };
}

/** Événement agenda (.ics) sur toute la période. */
export function icsEvent(opts: { uid: string; title: string; description: string; start: string; end: string }): MailAttachment {
  const d = (iso: string) => iso.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const escIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reservation valises//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(opts.start)}`,
    `DTEND;VALUE=DATE:${d(addDays(opts.end, 1))}`,
    `SUMMARY:${escIcs(opts.title)}`,
    `DESCRIPTION:${escIcs(opts.description)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return { filename: "reservation.ics", content, contentType: "text/calendar; charset=utf-8" };
}

export function periodFacts(p: { label: string; startDate: string; endDate: string }): [string, string][] {
  return [
    ["Période", p.label],
    ["Du", frLong(p.startDate)],
    ["Au", frLong(p.endDate)],
  ];
}

/**
 * Mode test : aucun SMTP configuré ET (développement local OU TEST_MODE=1).
 * Les liens envoyés par e-mail sont alors affichés directement à l'écran.
 * Ne jamais activer TEST_MODE sur un site ouvert aux écoles.
 */
export function testMode(): boolean {
  return !smtpConfigured() && (process.env.NODE_ENV !== "production" || process.env.TEST_MODE === "1");
}
