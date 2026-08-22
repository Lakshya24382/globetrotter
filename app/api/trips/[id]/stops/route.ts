import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { stopSchema } from '@/lib/validation/schemas'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  const { id: tripId } = await params
  const owned = await queryOne('SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [tripId, userId])
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = stopSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { cityId, startDate, endDate } = parsed.data

  const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) FROM stops WHERE trip_id = $1', [tripId])
  const stop = await queryOne(
    `INSERT INTO stops (trip_id, city_id, start_date, end_date, order_index)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tripId, cityId, startDate, endDate, Number(count)]
  )
  return NextResponse.json({ stop }, { status: 201 })
}
