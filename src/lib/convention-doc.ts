/**
 * Convention de prêt : modèle, remplissage des champs, rendu HTML et PDF.
 * Format du modèle (volontairement simple, modifiable par l'admin) :
 *   # Titre        ## Article        - élément de liste        **gras**
 *   Champs automatiques entre doubles accolades : {{ecole}}, {{periode}}…
 */
import PDFDocument from "pdfkit";

export const DEFAULT_TEMPLATE = `# Convention de prêt de matériel pédagogique

## Entre
**{{preteur}}**, {{preteur_adresse}}, représentée par {{preteur_representant}}, désignée comme « le prêteur » ;
et **l'Éducation nationale**, représentée par {{signataire}}, {{fonction}} de l'**{{ecole}}**, {{ecole_adresse}}, désignée comme « l'emprunteur ».
L'emprunteur s'engage à respecter les prescriptions ci-après.

## Préambule
La Ville de Méru met à disposition des écoles maternelles de la ville qui le souhaitent le matériel pédagogique **{{materiel}}** : {{presentation}} Le détail figure dans la fiche de prêt ci-après.
L'académie d'Amiens a apporté son soutien et assuré une formation lors du déploiement du dispositif.
Le planning de prêt est établi par le {{service_informatique}} et consultable en ligne : chaque école y réserve sa période.
L'emprunteur bénéficie du matériel temporairement et à titre gratuit pour la {{periode}}, du {{date_debut}} au {{date_fin}}.

## Article 1 – Acceptation en ligne
La présente convention est acceptée en ligne au moment de la réservation. La case « J'ai lu et j'accepte la convention de prêt » cochée par la directrice ou le directeur, accompagnée le cas échéant de sa signature, vaut signature. La date, l'heure et l'adresse e-mail de l'école sont enregistrées. Aucun document papier n'est à fournir.

## Article 2 – Fiche de prêt
La fiche de prêt ci-après fait partie de la convention. Elle est complétée contradictoirement par le {{service_informatique}} à la livraison et à la reprise du matériel : état de fonctionnement, accessoires et observations.

## Article 3 – Livraison et reprise
La livraison et la reprise du matériel sont effectuées **uniquement par le {{service_informatique}}**, à l'école, au début et à la fin de la période. Le transport est à la charge du prêteur et compris dans l'assurance qu'il a souscrite. L'emprunteur ne déplace pas le matériel hors de l'école et ne le confie pas à une autre école.

## Article 4 – Fin du prêt
Le matériel est tenu prêt pour la reprise, complet et rangé, au plus tard 24 heures avant le début des vacances scolaires ou à la date convenue avec le {{service_informatique}}.

## Article 5 – Stockage
Pendant toute la durée du prêt, le matériel est stocké dans un lieu sécurisé, sous la responsabilité du chef d'établissement : **{{lieu_stockage}}**.

## Article 6 – Utilisation
L'emprunteur s'engage à ne pas apporter de modification au matériel prêté (applications, réglages, comptes, étiquettes). Les accessoires – coques, cartes de programmation plastifiées, tapis de jeu – sont conservés au complet.

## Article 7 – Responsabilité
Le prêteur ne peut être tenu responsable en cas d'utilisation frauduleuse ou illicite du matériel emprunté.

## Article 8 – Dysfonctionnement
En cas de dysfonctionnement, l'emprunteur prévient immédiatement le {{service_informatique}} ({{contact_informatique}}), qui récupère le matériel ; l'incident est noté sur la fiche de prêt. L'école n'effectue aucune réparation.

## Article 9 – Entretien
L'emprunteur nettoie le matériel après chaque utilisation avec les lingettes désinfectantes mises à disposition.
`;

export const PLACEHOLDERS: [string, string][] = [
  ["preteur", "Prêteur (Ville de Méru)"],
  ["preteur_adresse", "Adresse du prêteur"],
  ["preteur_representant", "Représentant du prêteur (Maire)"],
  ["service_informatique", "Service chargé de la livraison"],
  ["contact_informatique", "Contact du service"],
  ["ecole", "Nom de l'école"],
  ["ecole_adresse", "Adresse de l'école"],
  ["signataire", "Directrice ou directeur"],
  ["fonction", "Fonction du signataire"],
  ["materiel", "Nom de la mallette"],
  ["presentation", "Présentation de la mallette"],
  ["inventaire", "Inventaire résumé"],
  ["periode", "Période et année scolaire"],
  ["date_debut", "Premier jour du prêt"],
  ["date_fin", "Dernier jour du prêt"],
  ["annee_scolaire", "Année scolaire"],
  ["lieu_stockage", "Lieu de stockage (indiqué à la signature)"],
];

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return nbsp(body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m)));
}

/** Typographie française : espaces insécables autour des guillemets et avant « : ; ! ? ». */
export function nbsp(s: string) {
  return s.replace(/« /g, "«\u00a0").replace(/ »/g, "\u00a0»").replace(/ ([:;!?])/g, "\u00a0$1");
}

/* ------------------------------------------------------------------ */

export type Block = { t: "h1" | "h2" | "p" | "li"; text: string };

/** Une ligne = un paragraphe ; « # », « ## » et « - » en début de ligne. */
export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) out.push({ t: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) out.push({ t: "h1", text: line.slice(2) });
    else if (/^[-•]\s+/.test(line)) out.push({ t: "li", text: line.replace(/^[-•]\s+/, "") });
    else out.push({ t: "p", text: line });
  }
  return out;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, '<mark class="field">$1</mark>');
}

/** HTML sûr (tout le texte est échappé) pour l'affichage web. */
export function toHtml(text: string): string {
  let html = "";
  let inList = false;
  for (const b of parseBlocks(text)) {
    if (b.t === "li" && !inList) {
      html += "<ul>";
      inList = true;
    }
    if (b.t !== "li" && inList) {
      html += "</ul>";
      inList = false;
    }
    const tag = b.t === "h1" ? "h1" : b.t === "h2" ? "h2" : b.t === "li" ? "li" : "p";
    html += `<${tag}>${inline(b.text)}</${tag}>`;
  }
  if (inList) html += "</ul>";
  return html;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export type PdfMeta = {
  number: string;
  lender: string;
  lenderAddress: string;
  lenderSignatory: { name: string; title: string };
  school: string;
  item: string;
  loan: { from: string; to: string };
  storage: string | null;
  sheet: { label: string; serial: string; qty: number; stateOut: string | null; stateIn: string | null }[];
  delivery: { at: string; by: string; note: string } | null;
  returned: { at: string; by: string; note: string } | null;
  appName: string;
  status: "to_sign" | "signed" | "cancelled";
  signer?: { name: string; title: string; email: string; at: string; method: string; image?: string | null } | null;
  amendments: { at: string; text: string }[];
};

/** Les polices standard du PDF (WinAnsi) ne connaissent pas certains caractères. */
export function pdfSafe(s: string) {
  return s
    .replace(/→/g, "–")
    .replace(/[  ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xff€œŒ–—…«»•]/g, "");
}

export function toPdf(text: string, meta: PdfMeta): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 64, left: 62, right: 62 },
      bufferPages: true,
      info: { Title: `Convention de prêt n° ${meta.number}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ink = "#1d2742";
    const muted = "#6f7790";
    const accent = "#2f5bd3";
    const left = 62;
    const width = doc.page.width - 124;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(accent).text(pdfSafe(meta.lender).toUpperCase(), left, 56, { characterSpacing: 0.6, width });
    doc.font("Helvetica").fontSize(8).fillColor(muted).text(pdfSafe(meta.lenderAddress), left, 68, { width });
    doc.font("Helvetica").fontSize(9).fillColor(muted).text(`Convention n° ${meta.number}`, left, 56, { align: "right", width });
    doc.y = 104;
    doc.x = left;

    const rich = (s: string, x: number, w: number, size: number, align: "left" | "justify") => {
      const parts = pdfSafe(s).split(/\*\*(.+?)\*\*/g);
      doc.fontSize(size).fillColor(ink);
      doc.x = x;
      parts.forEach((p, i) => {
        doc.font(i % 2 ? "Helvetica-Bold" : "Helvetica").text(p, { width: w, align, lineGap: 1.6, continued: i < parts.length - 1 });
      });
    };

    for (const b of parseBlocks(text)) {
      // pas de titre d'article seul en bas de page
      if (doc.y > doc.page.height - (b.t === "h2" ? 160 : 100)) doc.addPage();
      if (b.t === "h1") {
        doc.font("Helvetica-Bold").fontSize(19).fillColor(ink).text(pdfSafe(b.text), left, doc.y, { width });
        doc.moveTo(left, doc.y + 6).lineTo(left + 48, doc.y + 6).lineWidth(3).strokeColor("#e0625b").stroke();
        doc.moveDown(1.3);
      } else if (b.t === "h2") {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(11.5).fillColor(ink).text(pdfSafe(b.text), left, doc.y, { width });
        doc.moveDown(0.3);
      } else if (b.t === "li") {
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(accent).text("•", left + 4, y, { lineBreak: false });
        doc.y = y;
        rich(b.text, left + 18, width - 18, 10, "left");
        doc.moveDown(0.2);
      } else {
        rich(b.text, left, width, 10, "justify");
        doc.moveDown(0.4);
      }
      doc.x = left;
    }

    if (meta.amendments.length) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11.5).fillColor(ink).text("Modifications", left, doc.y, { width });
      doc.moveDown(0.2);
      for (const a of meta.amendments)
        doc.font("Helvetica").fontSize(9.5).fillColor(ink).text(pdfSafe(`${a.at} — ${a.text}`), left, doc.y, { width });
    }

    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(pdfSafe(`Fait à Méru, le ${meta.signer?.at.split(" à ")[0] ?? "…"}`), left, doc.y, { width, align: "right" });
    doc.moveDown(0.8);
    if (doc.y > doc.page.height - 230) doc.addPage();
    const top = doc.y;
    const colW = (width - 20) / 2;
    const h = 150;
    const box = (x: number, title: string, lines: string[], image?: string | null) => {
      doc.roundedRect(x, top, colW, h, 8).lineWidth(0.8).strokeColor("#d8d0bd").stroke();
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(muted).text(title.toUpperCase(), x + 12, top + 12, { width: colW - 24, characterSpacing: 0.5 });
      let y = top + 30;
      lines.forEach((l, i) => {
        doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(ink).text(pdfSafe(l), x + 12, y, { width: colW - 24 });
        y = doc.y + 2;
      });
      if (image?.startsWith("data:image/png;base64,")) {
        try {
          doc.image(Buffer.from(image.split(",")[1], "base64"), x + 12, y + 2, { fit: [colW - 24, Math.max(20, h - (y - top) - 12)] });
        } catch {
          /* image illisible : ignorée */
        }
      }
    };
    const s = meta.signer;
    box(
      left,
      "Pour l'école",
      meta.status === "cancelled"
        ? ["Réservation annulée"]
        : s
          ? [s.name, s.title, `Acceptée en ligne le ${s.at}`, `${s.method} (${s.email})`]
          : ["En attente de signature"],
      meta.status !== "cancelled" ? s?.image : null,
    );
    box(left + colW + 20, "Pour le prêteur", [
      meta.lenderSignatory.name,
      meta.lenderSignatory.title,
      meta.lender,
      `Convention établie et horodatée par la plateforme « ${meta.appName} ».`,
    ]);
    doc.y = top + h + 8;
    doc.x = left;

    /* ---------------- Fiche de prêt ---------------- */
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(17).fillColor(ink).text("Fiche de prêt", left, doc.y, { width });
    doc.moveTo(left, doc.y + 6).lineTo(left + 48, doc.y + 6).lineWidth(3).strokeColor("#e0625b").stroke();
    doc.moveDown(1.2);
    const info: [string, string][] = [
      ["Prêteur", meta.lender],
      ["Emprunteur", meta.school],
      ["Matériel", meta.item],
      ["Prêt", `du ${meta.loan.from} au ${meta.loan.to}`],
      ["Lieu de stockage", meta.storage || "à préciser par l'école"],
    ];
    for (const [k, v] of info) {
      const y = doc.y;
      doc.font("Helvetica").fontSize(9.5).fillColor(muted).text(k, left, y, { width: 110 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(ink).text(pdfSafe(v), left + 115, y, { width: width - 115 });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.6);

    const cols = [
      { t: "Désignation", w: 0.35 },
      { t: "N° de série", w: 0.21 },
      { t: "Qté", w: 0.06 },
      { t: "État à la remise", w: 0.19 },
      { t: "État à la reprise", w: 0.19 },
    ].map((c) => ({ ...c, w: c.w * width }));
    const row = (cells: string[], header = false) => {
      const y0 = doc.y;
      let x = left;
      let maxH = 0;
      cells.forEach((c, i) => {
        const hgt = doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 8.5 : 9).heightOfString(pdfSafe(c), { width: cols[i].w - 10 });
        maxH = Math.max(maxH, hgt);
      });
      const rh = maxH + 10;
      if (y0 + rh > doc.page.height - 80) {
        doc.addPage();
        return row(cells, header);
      }
      if (header) doc.rect(left, y0, width, rh).fill("#f3efe5");
      cells.forEach((c, i) => {
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 8.5 : 9).fillColor(header ? muted : ink).text(pdfSafe(c), x + 5, y0 + 5, { width: cols[i].w - 10 });
        x += cols[i].w;
      });
      doc.moveTo(left, y0 + rh).lineTo(left + width, y0 + rh).lineWidth(0.5).strokeColor("#d8d0bd").stroke();
      doc.y = y0 + rh;
    };
    row(cols.map((c) => c.t), true);
    for (const l of meta.sheet) row([l.label, l.serial || "N/A", String(l.qty), l.stateOut ?? "", l.stateIn ?? ""]);
    doc.moveDown(1);

    const handover = (title: string, d: { at: string; by: string; note: string } | null) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      const y0 = doc.y;
      doc.roundedRect(left, y0, width, 66, 8).lineWidth(0.8).strokeColor("#d8d0bd").stroke();
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(muted).text(title.toUpperCase(), left + 12, y0 + 10, { characterSpacing: 0.5 });
      doc.font("Helvetica").fontSize(9.5).fillColor(ink);
      if (d) {
        doc.text(pdfSafe(`Le ${d.at}, par ${d.by} (pour le prêteur), en présence de l'école.`), left + 12, y0 + 26, { width: width - 24 });
        doc.text(pdfSafe(`Observation : ${d.note || "—"}`), left + 12, doc.y + 2, { width: width - 24 });
      } else {
        doc.fillColor(muted).text("À compléter par le service informatique.", left + 12, y0 + 26, { width: width - 24 });
      }
      doc.y = y0 + 76;
      doc.x = left;
    };
    handover("Remise du matériel", meta.delivery);
    handover("Reprise du matériel", meta.returned);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // le pied de page ne doit pas créer de nouvelle page
      doc.font("Helvetica").fontSize(8).fillColor(muted).text(`Convention de prêt n° ${meta.number} — page ${i + 1}/${range.count}`, left, doc.page.height - 40, {
        width,
        align: "center",
        lineBreak: false,
      });
    }
    doc.end();
  });
}
