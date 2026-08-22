import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { z } from 'zod'

async function assertOwnedStop(tripId: string, stopId: string, userId: string | null) {
  if (!userId) return null
  return queryOne(
    `SELECT s.id FROM stops s
     JOIN trips t ON t.id = s.trip_id
     WHERE s.id = $1 AND t.id = $2 AND t.owner_id = $3`,
    [stopId, tripId, userId]
  )
}

const stopUpdateSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const userId = await getSessionUserId()
  const { id: tripId, stopId } = await params
  const owned = await assertOwnedStop(tripId, stopId, userId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = stopUpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { startDate, endDate } = parsed.data
  if (!startDate && !endDate) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const fields = Object.entries({ start_date: startDate, end_date: endDate }).filter(([, v]) => v !== undefined)
  const setClauses = fields.map(([col], i) => `${col} = $${i + 2}`)
  const values = fields.map(([, v]) => v)

  const stop = await queryOne(
    `UPDATE stops SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [stopId, ...values]
  )
  return NextResponse.json({ stop })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  const userId = await getSessionUserId()
  const { id: tripId, stopId } = await params
  const owned = await assertOwnedStop(tripId, stopId, userId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await queryOne('DELETE FROM stops WHERE id = $1 RETURNING id', [stopId])
  return NextResponse.json({ ok: true })
}
