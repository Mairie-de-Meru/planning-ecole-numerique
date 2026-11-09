import * as cheerio from "cheerio";
import type { HolidayKind, SchoolYearCalendar } from "./derive";

/**
 * Lecture de la page service-public.gouv.fr "Vacances scolaires" (F31952).
 * La structure HTML de la page n'étant pas garantie, deux stratégies :
 *   1. tableaux avec une colonne par zone (Zone A / Zone B / Zone C) ;
 *   2. lecture ligne à ligne du texte (titres "Zone B", libellés de vacances, dates).
 * On garde le résultat le plus complet.
 */

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

const DATE_RE =
  /(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+(\d{4}))?/gi;

const YEAR_RE = /(20\d{2})\s*[-–/]\s*(20\d{2})/;

type Kind = HolidayKind | "rentree";

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function classify(label: string): Kind | null {
  const l = label.toLowerCase();
  if (/rentr[ée]e/.test(l)) {
    if (/enseignant/.test(l) && !/[ée]l[èe]ve/.test(l)) return null;
    return "rentree";
  }
  if (/toussaint/.test(l)) return "toussaint";
  if (/no[ëe]l/.test(l)) return "noel";
  if (/hiver/.test(l)) return "hiver";
  if (/printemps/.test(l)) return "printemps";
  if (/[ée]t[ée]/.test(l) && /vacances|été|ete/.test(l)) return "ete";
  return null;
}

/** Extrait les dates d'un texte. Année manquante => déduite de l'année scolaire. */
export function extractDates(text: string, schoolYear?: string): string[] {
  const out: string[] = [];
  const [y1, y2] = schoolYear ? schoolYear.split("-").map(Number) : [NaN, NaN];
  for (const m of text.matchAll(DATE_RE)) {
    const day = Number(m[1]);
    const key = m[2].toLowerCase().replace("û", "u");
    const month = MONTHS[key] ?? MONTHS[key.normalize("NFD").replace(/[̀-ͯ]/g, "")];
    const year = m[3] ? Number(m[3]) : month >= 8 ? y1 : y2;
    if (!month || !year || Number.isNaN(year)) continue;
    out.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

/** Interprète le texte d'une cellule : "Fin des cours : … Reprise des cours : …" */
function parseHolidayText(text: string, kind: Kind, schoolYear: string) {
  const t = norm(text);
  if (kind === "rentree") {
    const d = extractDates(t, schoolYear);
    return d.length ? { start: d[0], end: null } : null;
  }
  const finIdx = t.search(/fin des cours|d[ée]but des vacances|du\b/i);
  const repIdx = t.search(/reprise des cours|reprise|jusqu/i);
  let start: string | undefined;
  let end: string | undefined;
  if (finIdx >= 0 && repIdx > finIdx) {
    start = extractDates(t.slice(finIdx, repIdx), schoolYear)[0];
    end = extractDates(t.slice(repIdx), schoolYear)[0];
  }
  if (!start) {
    const d = extractDates(t, schoolYear);
    start = d[0];
    end = d[1];
  }
  if (!start) return null;
  return { start, end: kind === "ete" ? null : end ?? null };
}

function emptyCal(schoolYear: string, zone: string): SchoolYearCalendar {
  return { schoolYear, zone, rentree: null, holidays: {} };
}

function setKind(cal: SchoolYearCalendar, kind: Kind, v: { start: string; end: string | null }) {
  if (kind === "rentree") {
    if (!cal.rentree) cal.rentree = v.start;
  } else if (!cal.holidays[kind]) {
    cal.holidays[kind] = v;
  }
}

function score(cals: SchoolYearCalendar[]) {
  return cals.reduce((n, c) => n + (c.rentree ? 1 : 0) + Object.keys(c.holidays).length, 0);
}

/* ---------- Stratégie 1 : tableaux ---------- */

function fromTables($: cheerio.CheerioAPI, zone: string): SchoolYearCalendar[] {
  const result = new Map<string, SchoolYearCalendar>();
  const zoneRe = new RegExp(`zone\\s*${zone}\\b`, "i");

  $("table").each((_, table) => {
    const $t = $(table);
    // Année scolaire : légende, ou texte qui précède le tableau.
    let yearText = norm($t.find("caption").text());
    if (!YEAR_RE.test(yearText)) {
      let prev = $t.prev();
      for (let i = 0; i < 6 && prev.length && !YEAR_RE.test(yearText); i++) {
        yearText = norm(prev.text());
        prev = prev.prev();
      }
      if (!YEAR_RE.test(yearText)) {
        const h = $t.closest("section,div,article").find("h2,h3,h4").first().text();
        yearText = norm(h);
      }
    }

    // Grille avec colspan/rowspan dépliés.
    const grid: string[][] = [];
    $t.find("tr").each((r, tr) => {
      grid[r] ??= [];
      let c = 0;
      $(tr)
        .children("th,td")
        .each((_, cell) => {
          while (grid[r][c] !== undefined) c++;
          const text = norm($(cell).text());
          const cs = Number($(cell).attr("colspan") ?? 1);
          const rs = Number($(cell).attr("rowspan") ?? 1);
          for (let dr = 0; dr < rs; dr++)
            for (let dc = 0; dc < cs; dc++) {
              grid[r + dr] ??= [];
              grid[r + dr][c + dc] = text;
            }
          c += cs;
        });
    });

    const headerRow = grid.findIndex((row) => row.some((cell) => zoneRe.test(cell ?? "")));
    if (headerRow < 0) return;
    const col = grid[headerRow].findIndex((cell) => zoneRe.test(cell ?? ""));
    const yearInHeader = grid[headerRow].join(" ").match(YEAR_RE);
    const ym = yearInHeader ?? yearText.match(YEAR_RE);

    for (let r = headerRow + 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row) continue;
      const kind = classify(row[0] ?? "");
      if (!kind) continue;
      const cellText = row[col] ?? row[row.length - 1] ?? "";
      const year = ym ? `${ym[1]}-${ym[2]}` : guessYear(cellText);
      if (!year) continue;
      const parsed = parseHolidayText(cellText, kind, year);
      if (!parsed) continue;
      const cal = result.get(year) ?? emptyCal(year, zone);
      setKind(cal, kind, parsed);
      result.set(year, cal);
    }
  });
  return [...result.values()];
}

function guessYear(text: string): string | null {
  const d = extractDates(text)[0];
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/* ---------- Stratégie 2 : texte ligne à ligne ---------- */

function fromLines($: cheerio.CheerioAPI, zone: string): SchoolYearCalendar[] {
  $("script,style,noscript,nav,footer,header").remove();
  $("br").replaceWith("\n");
  $("p,li,h1,h2,h3,h4,h5,h6,div,tr,td,th,dt,dd,span.title,button,summary").each((_, el) => {
    $(el).prepend("\n").append("\n");
  });
  const lines = $("body")
    .text()
    .split("\n")
    .map(norm)
    .filter(Boolean);

  const result = new Map<string, SchoolYearCalendar>();
  let year: string | null = null;
  let currentZone: string | null = null; // null = toutes zones
  let kind: Kind | null = null;
  let buffer = "";

  const flush = () => {
    if (year && kind && buffer) {
      const applies = currentZone === null || currentZone === zone;
      if (applies) {
        const parsed = parseHolidayText(buffer, kind, year);
        if (parsed) {
          const cal = result.get(year) ?? emptyCal(year, zone);
          setKind(cal, kind, parsed);
          result.set(year, cal);
        }
      }
    }
    buffer = "";
  };

  for (const line of lines) {
    const ym = line.length < 120 ? line.match(YEAR_RE) : null;
    if (ym && !DATE_RE.test(line)) {
      flush();
      year = `${ym[1]}-${ym[2]}`;
      kind = null;
      currentZone = null;
      DATE_RE.lastIndex = 0;
      continue;
    }
    DATE_RE.lastIndex = 0;
    const zm = line.match(/^zones?\s*([abc])\b/i);
    if (zm && kind && extractDates(line, year ?? undefined).length) {
      // "Zone B : fin des cours … reprise …" sur une seule ligne
      if (zm[1].toUpperCase() === zone && year) {
        const parsed = parseHolidayText(line, kind, year);
        if (parsed) {
          const cal = result.get(year) ?? emptyCal(year, zone);
          setKind(cal, kind, parsed);
          result.set(year, cal);
        }
      }
      buffer = "";
      continue;
    }
    if (zm && line.length < 40) {
      flush();
      currentZone = zm[1].toUpperCase();
      continue;
    }
    if (/toutes (les )?zones/i.test(line) && line.length < 60) {
      flush();
      currentZone = null;
    }
    const head = line.split(/\s:\s|:/)[0];
    const k = head.length < 80 ? classify(head) : null;
    if (k) {
      flush();
      kind = k;
      buffer = extractDates(line, year ?? undefined).length ? line : "";
      continue;
    }
    if (kind) buffer += " " + line;
  }
  flush();
  return [...result.values()];
}

export function parseServicePublic(html: string, zone: string): SchoolYearCalendar[] {
  const z = zone.toUpperCase();
  const a = fromTables(cheerio.load(html), z);
  const b = fromLines(cheerio.load(html), z);
  const best = score(a) >= score(b) ? a : b;
  return best.sort((x, y) => x.schoolYear.localeCompare(y.schoolYear));
}

export async function fetchCalendars(url: string, zone: string): Promise<SchoolYearCalendar[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ReservationValises/1.0)",
      Accept: "text/html",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`La page source a répondu ${res.status}`);
  const html = await res.text();
  return parseServicePublic(html, zone);
}
