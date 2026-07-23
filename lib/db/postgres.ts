import { Pool } from "pg";

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Missing database configuration. Set SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL.",
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
    });
  }

  return pool;
}

export async function queryPostgres<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPostgresPool().query<T>(text, values);
  return result.rows;
}
