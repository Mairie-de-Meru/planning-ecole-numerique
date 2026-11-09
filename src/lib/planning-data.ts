import "server-only";
import { periodState, todayParis } from "./dates";
import { crayonFor } from "./colors";
import { defaultSchoolYear, getPlanning, schoolYears } from "./reservations";
import type { GridItem, GridPeriod, GridSlot } from "@/components/planning";

/** Prépare les données du planning. En mode école, le nom des autres écoles n'est jamais transmis au navigateur. */
export async function planningData(opts: { zone: string; year?: string; mode: "school" | "admin"; schoolId?: string }) {
  const years = await schoolYears(opts.zone);
  const year = opts.year && years.includes(opts.year) ? opts.year : await defaultSchoolYear(opts.zone);
  const today = todayParis();
  if (!year) return { years, year: null, periods: [], items: [], slots: {}, today };
  const plan = await getPlanning({ zone: opts.zone, schoolYear: year, includeInactive: false });
  const periods: GridPeriod[] = plan.periods.map((p) => ({
    id: p.id,
    label: p.label,
    position: p.position,
    schoolYear: p.schoolYear,
    startDate: p.startDate,
    endDate: p.endDate,
    state: periodState(p),
  }));
  const items: GridItem[] = plan.items.map((i, idx) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    contents: i.contents,
    active: i.active,
    photoUrl: i.photoUrl,
    color: crayonFor(i.color, idx),
  }));
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
  return { years, year, periods, items, slots, today };
}

/** Couleur de chaque mallette (même ordre que le planning). */
export async function itemColors(): Promise<Map<string, string>> {
  const { db, schema } = await import("@/db");
  const { asc, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: schema.items.id, color: schema.items.color })
    .from(schema.items)
    .where(eq(schema.items.active, true))
    .orderBy(asc(schema.items.sortOrder), asc(schema.items.name));
  const all = await db.select({ id: schema.items.id, color: schema.items.color }).from(schema.items);
  const map = new Map(rows.map((r, i) => [r.id, crayonFor(r.color, i)]));
  for (const r of all) if (!map.has(r.id)) map.set(r.id, crayonFor(r.color, 0));
  return map;
}

/** Catalogue des mallettes proposées (avec leur couleur). */
export async function catalog() {
  const { db, schema } = await import("@/db");
  const { asc, eq } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(schema.items)
    .where(eq(schema.items.active, true))
    .orderBy(asc(schema.items.sortOrder), asc(schema.items.name));
  return rows.map((r, i) => ({ ...r, color: crayonFor(r.color, i) }));
}
