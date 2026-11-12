/**
 * Lancement d'une tâche à la demande, dans le conteneur de l'application :
 *   node dist/scheduler.cjs backup | sync | cleanup
 * (les tâches tournent d'elles-mêmes dans l'application, voir src/lib/jobs.ts)
 */
import { JOBS, type JobName } from "../src/lib/jobs";

async function main() {
  const name = process.argv[2] as JobName;
  if (!(name in JOBS)) throw new Error(`Tâche inconnue : ${name ?? ""} (backup, sync ou cleanup)`);
  console.log(name, JSON.stringify(await JOBS[name].run()));
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
