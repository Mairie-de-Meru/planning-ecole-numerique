import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";
import { hashToken, newToken } from "./tokens";
import { isAdmin } from "./settings";
import { isAllowed, normalizeEmail } from "./allowlist";
import type { School } from "@/db/schema";

export type CurrentUser = { email: string; admin: boolean; school: School | null };

export async function currentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // Retrait de la liste blanche => accès coupé immédiatement.
  const admin = await isAdmin(s.email);
  if (!admin && !(await isAllowed(s.email))) return null;
  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.email, s.email));
  return { email: s.email, admin, school: school ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await currentUser();
  if (!u) redirect("/connexion");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.admin) redirect("/");
  return u;
}

export function schoolProfileComplete(s: School | null): boolean {
  return !!s && !!s.name.trim() && !!s.address.trim();
}

export async function createLoginToken(email: string): Promise<string> {
  const { token, hash } = newToken();
  await db.insert(schema.loginTokens).values({
    tokenHash: hash,
    email: normalizeEmail(email),
    expiresAt: new Date(Date.now() + 20 * 60 * 1000),
  });
  return token;
}

export async function peekLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.loginTokens)
    .where(
      and(
        eq(schema.loginTokens.tokenHash, hashToken(token)),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
      ),
    );
  return row?.email ?? null;
}

/** Consomme le jeton et ouvre la session. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .update(schema.loginTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.loginTokens.tokenHash, hashToken(token)),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!row) return null;
  const email = row.email;
  // Crée la fiche école à la première connexion (sauf admin pur).
  if (!(await isAdmin(email)) || (await isAllowedNonAdmin(email))) {
    await db.insert(schema.schools).values({ email }).onConflictDoNothing();
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(email), sessionCookieOptions);
  return email;
}

async function isAllowedNonAdmin(email: string) {
  const rows = await db.select({ pattern: schema.allowlist.pattern }).from(schema.allowlist);
  const { matchesPattern } = await import("./allowlist");
  return rows.some((r) => matchesPattern(email, r.pattern));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
