import { Pool, type QueryResultRow } from 'pg'

const globalForPg = globalThis as unknown as { pgPool?: Pool }

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool

export async function query<T extends QueryResultRow = any>(text: string, params: any[] = []) {
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: any[] = []) {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}