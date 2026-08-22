import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requester = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId])
  if (!requester?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ count: userCount }] = await query<{ count: string }>('SELECT COUNT(*) FROM users')
  const [{ count: tripCount }] = await query<{ count: string }>('SELECT COUNT(*) FROM trips')
  const [{ count: publicTripCount }] = await query<{ count: string }>('SELECT COUNT(*) FROM trips WHERE is_public = TRUE')

  const topCities = await query<{ name: string; country: string; trip_count: string }>(
    `SELECT c.name, c.country, COUNT(DISTINCT s.trip_id) AS trip_count
     FROM cities c JOIN stops s ON s.city_id = c.id
     GROUP BY c.id, c.name, c.country
     ORDER BY trip_count DESC LIMIT 5`
  )
  const topActivities = await query<{ name: string; category: string; use_count: string }>(
    `SELECT a.name, a.category, COUNT(ta.id) AS use_count
     FROM activities a JOIN trip_activities ta ON ta.activity_id = a.id
     GROUP BY a.id, a.name, a.category
     ORDER BY use_count DESC LIMIT 5`
  )
  const recentUsers = await query<{ name: string; email: string; created_at: string }>(
    'SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 8'
  )

  return NextResponse.json({
    totals: { users: Number(userCount), trips: Number(tripCount), publicTrips: Number(publicTripCount) },
    topCities: topCities.map((c) => ({ ...c, trip_count: Number(c.trip_count) })),
    topActivities: topActivities.map((a) => ({ ...a, use_count: Number(a.use_count) })),
    recentUsers,
  })
}
