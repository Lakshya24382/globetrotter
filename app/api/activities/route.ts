import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cityId = searchParams.get('cityId')
  const category = searchParams.get('category')

  const clauses: string[] = []
  const values: string[] = []
  if (cityId) { values.push(cityId); clauses.push(`a.city_id = $${values.length}`) }
  if (category) { values.push(category); clauses.push(`a.category = $${values.length}`) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const activities = await query(
    `SELECT a.*, c.name AS city_name, c.country AS city_country
     FROM activities a JOIN cities c ON c.id = a.city_id
     ${where} ORDER BY a.name ASC`,
    values
  )
  return NextResponse.json({ activities })
}
