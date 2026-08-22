import { Pool } from 'pg'

const globalForPg = globalThis as unknown as { pgPool?: Pool }

// pg reads PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD from process.env automatically
export const pool = globalForPg.pgPool ?? new Pool({ max: 10 })

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool

export async function query<T = any>(text: string, params: any[] = []) {
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function queryOne<T = any>(text: string, params: any[] = []) {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}
