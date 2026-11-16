import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let connection: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

/** Returns null locally until DATABASE_URL is configured; callers must keep their feature usable. */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!database) {
    connection = postgres(url, { prepare: false, max: 3 });
    database = drizzle(connection, { schema });
  }
  return database;
}

export async function closeDb() { await connection?.end(); connection = undefined; database = undefined; }
