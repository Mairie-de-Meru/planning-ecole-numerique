import { cleanupJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Nettoyage quotidien (hébergement Vercel) : réservations non confirmées, jetons de connexion périmés. */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Non autorisé", { status: 401 });
  return Response.json(await cleanupJob());
}
