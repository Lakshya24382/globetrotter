import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { tripActivitySchema } from '@/lib/validation/schemas'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId, stopId } = await params
  const stop = await queryOne(
    `SELECT s.id FROM stops s
     JOIN trips t ON t.id = s.trip_id
     WHERE s.id = $1 AND t.id = $2 AND t.owner_id = $3`,
    [stopId, tripId, userId]
  )
  if (!stop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = tripActivitySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { activityId, date, startTime, cost, notes } = parsed.data

  const activity = await queryOne('SELECT id FROM activities WHERE id = $1', [activityId])
  if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  const tripActivity = await queryOne(
    `INSERT INTO trip_activities (stop_id, activity_id, date, start_time, cost, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [stopId, activityId, date, startTime, cost, notes ?? null]
  )
  const withMeta = await queryOne(
    `SELECT ta.*, a.name AS activity_name, a.category
     FROM trip_activities ta JOIN activities a ON a.id = ta.activity_id
     WHERE ta.id = $1`,
    [(tripActivity as any).id]
  )
  return NextResponse.json({ activity: withMeta }, { status: 201 })
}
