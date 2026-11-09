import "server-only";
import { periodState } from "./dates";
import { defaultSchoolYear, getPlanning, schoolYears } from "./reservations";
import type { GridItem, GridPeriod, GridSlot } from "@/components/planning";

/** Prépare les données du planning. En mode école, le nom des autres écoles n'est jamais transmis au navigateur. */
export async function planningData(opts: { zone: string; year?: string; mode: "school" | "admin"; schoolId?: string }) {
  const years = await schoolYears(opts.zone);
  const year = opts.year && years.includes(opts.year) ? opts.year : await defaultSchoolYear(opts.zone);
  if (!year) return { years, year: null, periods: [], items: [], slots: {} };
  const plan = await getPlanning({ zone: opts.zone, schoolYear: year, includeInactive: false });
  const periods: GridPeriod[] = plan.periods.map((p) => ({
    id: p.id,
    label: p.label,
    schoolYear: p.schoolYear,
    startDate: p.startDate,
    endDate: p.endDate,
    state: periodState(p),
  }));
  const items: GridItem[] = plan.items.map((i) => ({ id: i.id, name: i.name, description: i.description, contents: i.contents, active: i.active }));
  const slots: Record<string, GridSlot> = {};
  for (const [k, s] of plan.slots) {
    const mine = !!opts.schoolId && s.schoolId === opts.schoolId;
    slots[k] =
      opts.mode === "admin"
        ? { reservationId: s.reservationId, status: s.status, mine, schoolName: s.schoolName, schoolId: s.schoolId }
        : mine
          ? { reservationId: s.reservationId, status: s.status, mine: true }
          : { reservationId: "", status: s.status === "pending" ? "pending" : "confirmed", mine: false };
  }
  return { years, year, periods, items, slots };
}
