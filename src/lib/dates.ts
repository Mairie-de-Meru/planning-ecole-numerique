/** Dates "YYYY-MM-DD" (jours calendaires, fuseau Europe/Paris). */

export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmtShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function frShort(iso: string): string {
  return fmtShort.format(new Date(iso + "T12:00:00Z"));
}

export function frLong(iso: string): string {
  return fmtLong.format(new Date(iso + "T12:00:00Z"));
}

export function frRange(start: string, end: string): string {
  return `${frShort(start)} – ${frShort(end)}`;
}

export type PeriodState = "past" | "current" | "upcoming";

export function periodState(p: { startDate: string; endDate: string }, today = todayParis()): PeriodState {
  if (p.endDate < today) return "past";
  if (p.startDate <= today) return "current";
  return "upcoming";
}

/** Année scolaire contenant une date : "2026-2027". */
export function schoolYearOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
