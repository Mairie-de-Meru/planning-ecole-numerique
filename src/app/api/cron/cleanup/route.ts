import { lt, or, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { expireStalePending } from "@/lib/reservations";

export const dynamic = "force-dynamic";

/** Nettoyage quotidien : réservations non confirmées, jetons de connexion périmés. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Non autorisé", { status: 401 });
  const expired = await expireStalePending();
  await db
    .delete(schema.loginTokens)
    .where(or(lt(schema.loginTokens.expiresAt, new Date()), isNotNull(schema.loginTokens.usedAt)));
  return Response.json({ expired });
}
