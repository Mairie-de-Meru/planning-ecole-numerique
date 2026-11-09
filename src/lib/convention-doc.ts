/**
 * Convention de prêt : modèle, remplissage des champs, rendu HTML et PDF.
 * Format du modèle (volontairement simple, modifiable par l'admin) :
 *   # Titre        ## Article        - élément de liste        **gras**
 *   Champs automatiques entre doubles accolades : {{ecole}}, {{periode}}…
 */
import PDFDocument from "pdfkit";

export const DEFAULT_TEMPLATE = `# Convention de prêt de matériel pédagogique

## Entre les soussignés
**{{preteur}}**, {{preteur_adresse}}, ci-après « le prêteur », représenté pour l'exécution de la présente convention par le {{service_informatique}} ;
et **{{ecole}}**, {{ecole_adresse}}, ci-après « l'école », représentée par {{signataire}}, {{fonction}}.

## Article 1 – Objet
Le prêteur met gratuitement à la disposition de l'école le matériel pédagogique suivant : **{{materiel}}**.
{{inventaire}}
Valeur de remplacement indicative : {{valeur}}.

## Article 2 – Durée du prêt
Le prêt est consenti pour la {{periode}}, du {{date_debut}} au {{date_fin}}.

## Article 3 – Livraison et reprise
La livraison et la reprise du matériel sont effectuées **uniquement par le {{service_informatique}}**, à l'adresse de l'école, au début et à la fin de la période.
L'école ne transporte pas le matériel et ne le confie pas à une autre école ou à un tiers.
Le contenu est vérifié avec l'école à la livraison et à la reprise ; toute anomalie est signalée au {{service_informatique}}.

## Article 4 – Utilisation
- Le matériel est utilisé à des fins exclusivement pédagogiques, dans les locaux de l'école, sous la responsabilité des enseignants.
- Les élèves l'utilisent sous la surveillance d'un adulte.
- Sur les tablettes, aucune application n'est installée ou supprimée, aucun réglage n'est modifié et aucun compte personnel n'est créé.
- Les cartes de programmation plastifiées sont conservées au complet : chaque carte correspond à une instruction donnée au robot, une carte manquante rend le jeu incomplet.
- Aucune donnée personnelle des élèves (photos, prénoms, travaux) ne doit rester sur le matériel à la reprise.

## Article 5 – Conservation
Entre deux séances, le matériel est rangé dans un local fermé, à l'abri de la chaleur, de l'humidité et des chocs, et rechargé selon les consignes fournies.

## Article 6 – Incident, perte ou dégradation
Toute panne, perte ou dégradation est signalée sans délai au {{service_informatique}} ({{contact_informatique}}). L'école n'effectue aucune réparation elle-même.

## Article 7 – Maintenance
Le {{service_informatique}} assure la maintenance du matériel pendant les vacances scolaires, entre deux prêts. Les tablettes sont réinitialisées à chaque reprise : les contenus créés pendant le prêt sont effacés.

## Article 8 – Décalage et annulation
La réservation peut être décalée ou annulée depuis la plateforme de réservation jusqu'au début de la période. Un décalage met à jour les dates de la présente convention sans nouvelle signature.

## Article 9 – Acceptation
La présente convention est acceptée en ligne. La case « J'ai lu et j'accepte la convention de prêt » cochée par le signataire, accompagnée le cas échéant de sa signature, vaut signature. La date, l'heure et l'adresse e-mail de l'école sont enregistrées.
`;

export const PLACEHOLDERS: [string, string][] = [
  ["preteur", "Nom du prêteur"],
  ["preteur_adresse", "Adresse du prêteur"],
  ["service_informatique", "Service chargé de la livraison"],
  ["contact_informatique", "Contact du service"],
  ["ecole", "Nom de l'école"],
  ["ecole_adresse", "Adresse de l'école"],
  ["signataire", "Nom du signataire"],
  ["fonction", "Directrice / Directeur"],
  ["materiel", "Nom de la mallette"],
  ["inventaire", "Inventaire (une ligne par élément)"],
  ["valeur", "Valeur de remplacement"],
  ["periode", "Période et année scolaire"],
  ["date_debut", "Premier jour du prêt"],
  ["date_fin", "Dernier jour du prêt"],
  ["annee_scolaire", "Année scolaire"],
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
    doc.font("Helvetica").fontSize(9).fillColor(muted).text(`Convention n° ${meta.number}`, left, 56, { align: "right", width });
    doc.moveDown(1.4);

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

    doc.moveDown(1.4);
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
    box(left + colW + 20, "Pour le prêteur", [meta.lender, `Convention établie et horodatée par la plateforme « ${meta.appName} ».`]);

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
