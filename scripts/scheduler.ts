/**
 * Tâches planifiées (conteneur « mallettes-cron ») :
 *   - lecture des dates de vacances : chaque lundi à 5 h 17
 *   - nettoyage (réservations non confirmées, jetons) : chaque nuit à 3 h 43
 *   - sauvegarde de la base : chaque nuit à 2 h 30, conservée BACKUP_DAYS jours
 * Heures de Paris. Usage ponctuel : node dist/scheduler.cjs backup|sync|cleanup
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const APP = (process.env.APP_INTERNAL_URL ?? "http://mallettes-app:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET ?? "";
const BACKUP_DIR = process.env.BACKUP_DIR ?? "/backups";
const BACKUP_DAYS = Number(process.env.BACKUP_DAYS ?? 30);

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function call(task: "sync" | "cleanup") {
  const res = await fetch(`${APP}/api/cron/${task}`, { headers: { Authorization: `Bearer ${SECRET}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${task} : HTTP ${res.status} ${body}`);
  log(task, body);
}

async function backup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  mkdirSync(BACKUP_DIR, { recursive: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const file = join(BACKUP_DIR, `mallettes-${day}.sql.gz`);
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
  log("sauvegarde", file, `${Math.round(statSync(file).size / 1024)} Ko`);
  // Rotation : suppression des sauvegardes trop anciennes de ce dossier uniquement
  const limit = Date.now() - BACKUP_DAYS * 86_400_000;
  for (const name of readdirSync(BACKUP_DIR)) {
    if (!/^mallettes-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(name)) continue;
    const p = join(BACKUP_DIR, name);
    if (statSync(p).mtimeMs < limit) {
      unlinkSync(p);
      log("ancienne sauvegarde supprimée", name);
    }
  }
}

type Job = { name: string; due: (t: { dow: number; h: number; m: number }) => boolean; run: () => Promise<void> };

const JOBS: Job[] = [
  { name: "sync", due: (t) => t.dow === 1 && t.h === 5 && t.m === 17, run: () => call("sync") },
  { name: "cleanup", due: (t) => t.h === 3 && t.m === 43, run: () => call("cleanup") },
  { name: "backup", due: (t) => t.h === 2 && t.m === 30, run: backup },
];

function parisNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dow, h: Number(get("hour")), m: Number(get("minute")), key: `${get("weekday")}-${get("hour")}:${get("minute")}` };
}

async function runJob(job: Job) {
  try {
    await job.run();
  } catch (e) {
    log("ÉCHEC", job.name, e instanceof Error ? e.message : e);
  }
}

async function main() {
  const once = process.argv[2];
  if (once) {
    const job = JOBS.find((j) => j.name === once);
    if (!job) throw new Error(`Tâche inconnue : ${once} (backup, sync ou cleanup)`);
    await job.run();
    return;
  }
  log("Tâches planifiées actives (heure de Paris) : vacances lundi 5 h 17, nettoyage 3 h 43, sauvegarde 2 h 30.");
  let last = "";
  setInterval(() => {
    const now = parisNow();
    if (now.key === last) return;
    last = now.key;
    for (const job of JOBS) if (job.due(now)) void runJob(job);
  }, 15_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
