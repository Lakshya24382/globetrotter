import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stopId: string; activityId: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId, stopId, activityId } = await params
  const owned = await queryOne(
    `SELECT ta.id FROM trip_activities ta
     JOIN stops s ON s.id = ta.stop_id
     JOIN trips t ON t.id = s.trip_id
     WHERE ta.id = $1 AND s.id = $2 AND t.id = $3 AND t.owner_id = $4`,
    [activityId, stopId, tripId, userId]
  )
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await queryOne('DELETE FROM trip_activities WHERE id = $1 RETURNING id', [activityId])
  return NextResponse.json({ ok: true })
}
