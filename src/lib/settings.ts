import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Settings } from "@/db/schema";

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(schema.settings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  return (await db.select().from(schema.settings).where(eq(schema.settings.id, 1)))[0];
}

export async function updateSettings(patch: Partial<Omit<Settings, "id">>) {
  await getSettings();
  await db.update(schema.settings).set(patch).where(eq(schema.settings.id, 1));
}

export function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function adminEmails(): Promise<string[]> {
  const rows = await db.select().from(schema.admins);
  return [...new Set([...envAdminEmails(), ...rows.map((r) => r.email)])];
}

export async function isAdmin(email: string): Promise<boolean> {
  return (await adminEmails()).includes(email.toLowerCase());
}

export function appUrl(): string {
  const u =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return u.replace(/\/$/, "");
}
