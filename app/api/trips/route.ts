import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { tripSchema } from '@/lib/validation/schemas'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trips = await query(
    `SELECT t.*, COALESCE(json_agg(
        json_build_object('id', s.id, 'startDate', s.start_date, 'endDate', s.end_date,
                           'city', json_build_object('id', c.id, 'name', c.name, 'country', c.country))
        ORDER BY s.order_index
      ) FILTER (WHERE s.id IS NOT NULL), '[]') AS stops,
      COALESCE(spend.total_spent, 0) AS total_spent
     FROM trips t
     LEFT JOIN stops s ON s.trip_id = t.id
     LEFT JOIN cities c ON c.id = s.city_id
     LEFT JOIN (
       SELECT s2.trip_id, SUM(ta.cost) AS total_spent
       FROM trip_activities ta
       JOIN stops s2 ON s2.id = ta.stop_id
       GROUP BY s2.trip_id
     ) spend ON spend.trip_id = t.id
     WHERE t.owner_id = $1
     GROUP BY t.id, spend.total_spent
     ORDER BY t.start_date ASC`,
    [userId]
  )
  return NextResponse.json({ trips })
}

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = tripSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { name, description, startDate, endDate, coverPhoto, budgetAmount } = parsed.data

  const trip = await queryOne(
    `INSERT INTO trips (owner_id, name, description, start_date, end_date, cover_photo, budget_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, name, description ?? null, startDate, endDate, coverPhoto ?? null, budgetAmount ?? null]
  )
  return NextResponse.json({ trip }, { status: 201 })
}
