import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  try {
    const trip = await queryOne<{ budget_amount: string | null; start_date: string; end_date: string }>(
      `SELECT budget_amount, start_date, end_date FROM trips WHERE id = $1`,
      [tripId]
    )
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const byCategoryRows = await query<{ category: string; total: string }>(
      `SELECT a.category, SUM(ta.cost) AS total
       FROM trip_activities ta
       JOIN activities a ON a.id = ta.activity_id
       JOIN stops s ON s.id = ta.stop_id
       WHERE s.trip_id = $1
       GROUP BY a.category`,
      [tripId]
    )

    const byCityRows = await query<{ city_name: string; total: string }>(
      `SELECT c.name AS city_name, SUM(ta.cost) AS total
       FROM trip_activities ta
       JOIN stops s ON s.id = ta.stop_id
       JOIN cities c ON c.id = s.city_id
       WHERE s.trip_id = $1
       GROUP BY c.name
       ORDER BY total DESC`,
      [tripId]
    )

    // Per-stop breakdown, including stops with no costed activities yet (LEFT JOIN),
    // ordered by itinerary sequence rather than spend so it reads as a trip timeline.
    const byStopRows = await query<{
      stop_id: string; city_name: string; city_country: string
      start_date: string; end_date: string; order_index: number
      total: string | null; activity_count: string
    }>(
      `SELECT s.id AS stop_id, c.name AS city_name, c.country AS city_country,
              s.start_date, s.end_date, s.order_index,
              COALESCE(SUM(ta.cost), 0) AS total,
              COUNT(ta.id) AS activity_count
       FROM stops s
       JOIN cities c ON c.id = s.city_id
       LEFT JOIN trip_activities ta ON ta.stop_id = s.id
       WHERE s.trip_id = $1
       GROUP BY s.id, c.name, c.country, s.start_date, s.end_date, s.order_index
       ORDER BY s.order_index ASC`,
      [tripId]
    )

    const byDayRows = await query<{ date: string; total: string }>(
      `SELECT ta.date, SUM(ta.cost) AS total
       FROM trip_activities ta
       JOIN stops s ON s.id = ta.stop_id
       WHERE s.trip_id = $1
       GROUP BY ta.date
       ORDER BY ta.date ASC`,
      [tripId]
    )

    const byCategory: Record<string, number> = {}
    let total = 0
    for (const row of byCategoryRows) {
      const amount = Number(row.total)
      byCategory[row.category] = amount
      total += amount
    }

    const byCity = byCityRows.map((row) => ({ city: row.city_name, total: Number(row.total) }))
    const byStop = byStopRows.map((row) => ({
      stopId: row.stop_id,
      city: row.city_name,
      country: row.city_country,
      startDate: row.start_date,
      endDate: row.end_date,
      total: Number(row.total ?? 0),
      activityCount: Number(row.activity_count),
    }))
    const byDay = byDayRows.map((row) => ({ date: row.date, total: Number(row.total) }))

    const budgetAmount = trip.budget_amount != null ? Number(trip.budget_amount) : null
    const remaining = budgetAmount != null ? budgetAmount - total : null
    const percentUsed = budgetAmount != null && budgetAmount > 0 ? Math.round((total / budgetAmount) * 1000) / 10 : null
    const isOverBudget = budgetAmount != null ? total > budgetAmount : false

    // Days elapsed vs total trip days, used to flag "burning too fast" even before the trip ends
    const tripDays = Math.max(
      1,
      Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86_400_000) + 1
    )
    const averagePerDay = total > 0 ? Math.round((total / tripDays) * 100) / 100 : 0

    return NextResponse.json({
      total,
      budgetAmount,
      remaining,
      percentUsed,
      isOverBudget,
      averagePerDay,
      tripDays,
      byCategory,
      byCity,
      byStop,
      byDay,
    })
  } catch (err) {
    console.error('GET /api/trips/[id]/budget failed:', err)
    return NextResponse.json(
      { error: 'Could not load budget. If you recently pulled new code, make sure db/schema.sql has been re-run against your database (it adds the budget_amount column).' },
      { status: 500 }
    )
  }
}