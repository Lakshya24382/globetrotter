import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'
import { z } from 'zod'

const reorderSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId } = await params
  const owned = await queryOne('SELECT id FROM trips WHERE id = $1 AND owner_id = $2', [tripId, userId])
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = reorderSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { order } = parsed.data

  // make sure every stop id actually belongs to this trip before touching anything
  const existing = await query<{ id: string }>('SELECT id FROM stops WHERE trip_id = $1', [tripId])
  const existingIds = new Set(existing.map((s) => s.id))
  if (order.length !== existingIds.size || !order.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: 'Order must include exactly the stops on this trip' }, { status: 400 })
  }

  await Promise.all(
    order.map((stopId, index) => query('UPDATE stops SET order_index = $2 WHERE id = $1', [stopId, index]))
  )

  const stops = await query(
    `SELECT s.*, c.name AS city_name, c.country AS city_country
     FROM stops s JOIN cities c ON c.id = s.city_id
     WHERE s.trip_id = $1 ORDER BY s.order_index`,
    [tripId]
  )
  return NextResponse.json({ stops })
}
