import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  const cities = q
    ? await query(
        `SELECT * FROM cities WHERE name ILIKE $1 OR country ILIKE $1
         ORDER BY popularity DESC LIMIT 30`,
        [`%${q}%`]
      )
    : await query('SELECT * FROM cities ORDER BY popularity DESC LIMIT 30')
  return NextResponse.json({ cities })
}
