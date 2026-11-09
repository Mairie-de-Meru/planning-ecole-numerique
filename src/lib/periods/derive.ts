import { addDays } from "../dates";

export type HolidayKind = "toussaint" | "noel" | "hiver" | "printemps" | "ete";

/** Calendrier d'une année scolaire pour une zone. Dates ISO.
 *  - rentree : premier jour de classe
 *  - holidays[k].start : jour de "fin des cours" (début des vacances, après la classe)
 *  - holidays[k].end   : jour de "reprise des cours"
 */
export type SchoolYearCalendar = {
  schoolYear: string;
  zone: string;
  rentree: string | null;
  holidays: Partial<Record<HolidayKind, { start: string; end: string | null }>>;
};

export type DerivedPeriod = {
  schoolYear: string;
  position: number;
  label: string;
  startDate: string;
  endDate: string;
  zone: string;
};

const ORDER: { from: "rentree" | HolidayKind; to: HolidayKind; label: string }[] = [
  { from: "rentree", to: "toussaint", label: "Rentrée → Toussaint" },
  { from: "toussaint", to: "noel", label: "Toussaint → Noël" },
  { from: "noel", to: "hiver", label: "Noël → Hiver" },
  { from: "hiver", to: "printemps", label: "Hiver → Printemps" },
  { from: "printemps", to: "ete", label: "Printemps → Été" },
];

/**
 * Déduit les 5 périodes de classe entre deux vacances.
 * Le dernier jour d'une période est la veille du jour de "fin des cours"
 * si celui-ci est un samedi (cas général) ; sinon le jour même.
 */
export function derivePeriods(cal: SchoolYearCalendar, opts: { splitJune?: boolean } = {}): DerivedPeriod[] {
  const out: DerivedPeriod[] = [];
  ORDER.forEach((step, i) => {
    const start = step.from === "rentree" ? cal.rentree : cal.holidays[step.from]?.end ?? null;
    const holidayStart = cal.holidays[step.to]?.start ?? null;
    if (!start || !holidayStart) return;
    const end = lastSchoolDay(holidayStart);
    if (end < start) return;
    out.push({
      schoolYear: cal.schoolYear,
      position: i + 1,
      label: step.label,
      startDate: start,
      endDate: end,
      zone: cal.zone,
    });
  });
  if (opts.splitJune) return splitLast(out);
  return out;
}

/**
 * Découpe « Printemps → Été » en deux périodes, comme dans les conventions de la ville :
 * « Printemps → Juin » jusqu'au vendredi précédant la semaine du 1er juin, puis « Juin → Été ».
 */
function splitLast(periods: DerivedPeriod[]): DerivedPeriod[] {
  const last = periods.at(-1);
  if (!last || last.position !== 5) return periods;
  const year = last.endDate.slice(0, 4);
  const june1 = new Date(`${year}-06-01T12:00:00Z`);
  const dow = june1.getUTCDay() || 7; // lundi = 1 … dimanche = 7
  const monday = addDays(`${year}-06-01`, dow <= 5 ? 1 - dow : 8 - dow); // lundi de la semaine du 1er juin (ou suivant si week-end)
  const friday = addDays(monday, -3);
  if (!(last.startDate < friday && monday < last.endDate)) return periods;
  return [
    ...periods.slice(0, -1),
    { ...last, label: "Printemps → Juin", endDate: friday },
    { ...last, position: 6, label: "Juin → Été", startDate: monday },
  ];
}

function lastSchoolDay(finDesCours: string): string {
  const dow = new Date(finDesCours + "T12:00:00Z").getUTCDay(); // 6 = samedi
  if (dow === 6) return addDays(finDesCours, -1);
  if (dow === 0) return addDays(finDesCours, -2);
  return finDesCours;
}
