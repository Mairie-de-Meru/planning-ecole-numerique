import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __pg: ReturnType<typeof postgres> | undefined;
}

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant (voir .env.example)");
  // prepare:false => compatible avec les poolers (Neon, Supabase).
  return postgres(url, { prepare: false, max: 5 });
}

const pg = globalThis.__pg ?? client();
if (process.env.NODE_ENV !== "production") globalThis.__pg = pg;

export const db = drizzle(pg, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
