import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { deliveries } from "@/lib/deliveries";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.admin) return new Response("Accès refusé", { status: 403 });
  const id = new URL(req.url).searchParams.get("periode") ?? "";
  const [period] = await db.select().from(schema.periods).where(eq(schema.periods.id, id));
  if (!period) return new Response("Période introuvable", { status: 404 });
  const rows = await deliveries(id);
  const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, ", ")}"`;
  const lines = [
    ["École", "Adresse", "Contact", "Téléphone", "E-mail", "Valise", "Début", "Fin"].map(cell).join(";"),
    ...rows.map(({ item, school }) =>
      [school.name, school.address, school.contactName, school.phone, school.email, item.name, period.startDate, period.endDate].map(cell).join(";"),
    ),
  ];
  const name = `livraisons-${period.schoolYear}-${period.position}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
