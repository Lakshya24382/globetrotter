import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const rows = await query<{ category: string; total: string }>(
    `SELECT a.category, SUM(ta.cost) AS total
     FROM trip_activities ta
     JOIN activities a ON a.id = ta.activity_id
     JOIN stops s ON s.id = ta.stop_id
     WHERE s.trip_id = $1
     GROUP BY a.category`,
    [tripId]
  )
  const byCategory: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    const amount = Number(row.total)
    byCategory[row.category] = amount
    total += amount
  }
  return NextResponse.json({ total, byCategory })
}
