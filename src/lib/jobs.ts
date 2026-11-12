/**
 * Tâches planifiées, exécutées dans le processus de l'application (aucun conteneur à part) :
 *   - lecture des dates de vacances : chaque lundi à 5 h 17
 *   - nettoyage (réservations non confirmées, jetons) : chaque nuit à 3 h 43
 *   - sauvegarde de la base : chaque nuit à 2 h 30, conservée BACKUP_DAYS jours
 * Heures de Paris. À la demande : node dist/scheduler.cjs backup|sync|cleanup
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
// Les modules de l'application (base, réservations, PDF…) ne sont chargés qu'à l'exécution
// d'une tâche : le planificateur ne coûte presque rien en mémoire tant qu'il attend.

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[tâches]", ...a);

export async function cleanupJob() {
  const [{ isNotNull, lt, or }, { db, schema }, { expireStalePending }] = await Promise.all([
    import("drizzle-orm"),
    import("@/db"),
    import("./reservations"),
  ]);
  const expired = await expireStalePending();
  await db.delete(schema.loginTokens).where(or(lt(schema.loginTokens.expiresAt, new Date()), isNotNull(schema.loginTokens.usedAt)));
  return { expired };
}

export async function syncJob() {
  const [{ getSettings }, { runSync }] = await Promise.all([import("./settings"), import("./periods/sync")]);
  const settings = await getSettings();
  if (!settings.syncEnabled) return { skipped: true };
  return runSync();
}

export async function backupJob() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  const dir = process.env.BACKUP_DIR ?? "/backups";
  const days = Number(process.env.BACKUP_DAYS ?? 30);
  mkdirSync(dir, { recursive: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const file = join(dir, `mallettes-${day}.sql.gz`);
  const tmp = `${file}.tmp`;
  const dump = spawn("pg_dump", ["--no-owner", "--dbname", url], { stdio: ["ignore", "pipe", "inherit"] });
  const exited = new Promise<number>((resolve, reject) => {
    dump.on("error", reject);
    dump.on("close", (code) => resolve(code ?? 1));
  });
  try {
    await pipeline(dump.stdout, createGzip(), createWriteStream(tmp, { mode: 0o600 }));
    const code = await exited;
    if (code !== 0) throw new Error(`pg_dump a échoué (code ${code})`);
    renameSync(tmp, file);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* fichier temporaire absent */
    }
    throw e;
  }
  // Rotation : seules les sauvegardes de ce dossier au format attendu sont concernées
  const limit = Date.now() - days * 86_400_000;
  for (const name of readdirSync(dir)) {
    if (!/^mallettes-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(name)) continue;
    const p = join(dir, name);
    if (statSync(p).mtimeMs < limit) unlinkSync(p);
  }
  return { file, ko: Math.round(statSync(file).size / 1024) };
}

export const JOBS = {
  sync: { due: (t: ParisTime) => t.dow === 1 && t.h === 5 && t.m === 17, run: syncJob },
  cleanup: { due: (t: ParisTime) => t.h === 3 && t.m === 43, run: cleanupJob },
  backup: { due: (t: ParisTime) => t.h === 2 && t.m === 30, run: backupJob },
} as const;

export type JobName = keyof typeof JOBS;
type ParisTime = { dow: number; h: number; m: number; key: string };

function parisNow(): ParisTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    h: Number(get("hour")),
    m: Number(get("minute")),
    key: `${get("weekday")}-${get("hour")}:${get("minute")}`,
  };
}

export async function runJob(name: JobName) {
  try {
    log(name, JSON.stringify(await JOBS[name].run()));
  } catch (e) {
    log("ÉCHEC", name, e instanceof Error ? e.message : e);
  }
}

declare global {
  var __scheduler: NodeJS.Timeout | undefined;
}

export function startScheduler() {
  if (globalThis.__scheduler) return;
  log("actives (heure de Paris) : vacances lundi 5 h 17, nettoyage 3 h 43, sauvegarde 2 h 30");
  let last = "";
  globalThis.__scheduler = setInterval(() => {
    const now = parisNow();
    if (now.key === last) return;
    last = now.key;
    for (const [name, job] of Object.entries(JOBS)) if (job.due(now)) void runJob(name as JobName);
  }, 20_000);
  globalThis.__scheduler.unref();
}
