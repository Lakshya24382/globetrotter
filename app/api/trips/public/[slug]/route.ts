import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const trip = await queryOne(
    `SELECT t.id, t.name, t.description, t.cover_photo, t.start_date, t.end_date, u.name AS owner_name
     FROM trips t
     JOIN users u ON u.id = t.owner_id
     WHERE t.share_slug = $1 AND t.is_public = TRUE`,
    [slug]
  )
  if (!trip) return NextResponse.json({ error: 'This trip is not shared or does not exist' }, { status: 404 })

  const stops = await query(
    `SELECT s.id, s.start_date, s.end_date, s.order_index, c.name AS city_name, c.country AS city_country
     FROM stops s JOIN cities c ON c.id = s.city_id
     WHERE s.trip_id = $1 ORDER BY s.order_index`,
    [(trip as any).id]
  )
  const activities = await query(
    `SELECT ta.stop_id, ta.date, ta.start_time, ta.cost, ta.notes, a.name AS activity_name, a.category
     FROM trip_activities ta
     JOIN activities a ON a.id = ta.activity_id
     WHERE ta.stop_id = ANY($1::uuid[])
     ORDER BY ta.date, ta.start_time`,
    [stops.map((s: any) => s.id)]
  )
  return NextResponse.json({ trip, stops, activities })
}
