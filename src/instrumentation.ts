/** Démarrage du serveur : lance les tâches planifiées quand l'application tourne sur la VM (image Docker). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCHEDULER !== "on") return; // activé dans l'image Docker uniquement
  const { startScheduler } = await import("./lib/jobs");
  startScheduler();
}
