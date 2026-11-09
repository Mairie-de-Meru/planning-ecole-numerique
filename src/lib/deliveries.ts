import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function deliveries(periodId: string) {
  return db
    .select({ r: schema.reservations, item: schema.items, school: schema.schools })
    .from(schema.reservations)
    .innerJoin(schema.items, eq(schema.items.id, schema.reservations.itemId))
    .innerJoin(schema.schools, eq(schema.schools.id, schema.reservations.schoolId))
    .where(and(eq(schema.reservations.periodId, periodId), eq(schema.reservations.status, "confirmed")))
    .orderBy(asc(schema.schools.name), asc(schema.items.name));
}
