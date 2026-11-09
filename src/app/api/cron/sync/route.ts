import { getSettings } from "@/lib/settings";
import { runSync } from "@/lib/periods/sync";

export const dynamic = "force-dynamic";

/** Appelé chaque semaine par Vercel Cron (voir vercel.json). */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("Non autorisé", { status: 401 });
  const settings = await getSettings();
  if (!settings.syncEnabled) return Response.json({ skipped: true });
  return Response.json(await runSync());
}
