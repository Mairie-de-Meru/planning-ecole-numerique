import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant (voir .env.example)");
  // prepare:false => compatible avec les poolers (Neon, Supabase).
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
}

type Database = ReturnType<typeof connect>;

declare global {
  var __db: Database | undefined;
}

/**
 * Connexion créée à la première utilisation, pas au chargement du module :
 * la construction de l'application (next build, image Docker) se fait sans base.
 */
function instance(): Database {
  if (!globalThis.__db) globalThis.__db = connect();
  return globalThis.__db;
}

export const db = new Proxy({} as Database, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type DB = Database;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
