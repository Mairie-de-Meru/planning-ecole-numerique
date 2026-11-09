import { db, schema } from "@/db";
import { isAdmin } from "./settings";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** "ecole@x.fr" (adresse exacte) ou "@x.fr" / "x.fr" (domaine entier). */
export function matchesPattern(email: string, pattern: string): boolean {
  const e = normalizeEmail(email);
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p.includes("@") && !p.startsWith("@")) return e === p;
  const domain = p.replace(/^@/, "");
  return e.endsWith("@" + domain);
}

export async function isAllowed(email: string): Promise<boolean> {
  if (await isAdmin(email)) return true;
  const rows = await db.select({ pattern: schema.allowlist.pattern }).from(schema.allowlist);
  return rows.some((r) => matchesPattern(email, r.pattern));
}
