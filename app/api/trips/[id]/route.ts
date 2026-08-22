import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { tripSchema } from '@/lib/validation/schemas'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trip = await queryOne('SELECT * FROM trips WHERE id = $1', [id])
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stops = await query(
    `SELECT s.*, c.name AS city_name, c.country AS city_country
     FROM stops s JOIN cities c ON c.id = s.city_id
     WHERE s.trip_id = $1 ORDER BY s.order_index`,
    [id]
  )
  const activities = await query(
    `SELECT ta.*, a.name AS activity_name, a.category
     FROM trip_activities ta
     JOIN activities a ON a.id = ta.activity_id
     WHERE ta.stop_id = ANY($1::uuid[])`,
    [stops.map((s: any) => s.id)]
  )
  return NextResponse.json({ trip, stops, activities })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  const { id } = await params
  const owned = await queryOne('SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [id, userId])
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = tripSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const fields = Object.entries(parsed.data)
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const columnMap: Record<string, string> = { name: 'name', description: 'description', startDate: 'start_date', endDate: 'end_date', coverPhoto: 'cover_photo' }
  const setClauses = fields.map(([key], i) => `${columnMap[key]} = $${i + 2}`)
  const values = fields.map(([, value]) => value)

  const trip = await queryOne(
    `UPDATE trips SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return NextResponse.json({ trip })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  const { id } = await params
  const owned = await queryOne('SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [id, userId])
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await query('DELETE FROM trips WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
