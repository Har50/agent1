import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config/env.js';

export type Db = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | null = null;
let db: Db | null = null;

export function getDb(): Db | null {
  if (!config.DATABASE_URL) return null;
  if (!db) {
    sql = postgres(config.DATABASE_URL, { max: 5, idle_timeout: 20 });
    db = drizzle(sql, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    db = null;
  }
}
