import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import type { AdminStatsResponse, EngagementSummary, TimeSeriesPoint } from "@/types/admin";

// Swap the `db.*` calls below for your actual ORM/query layer (Prisma, Drizzle,
// raw SQL, etc). The shape returned to the client is what matters.

const TIME_SERIES_DAYS = 30;

async function getEngagementSummary(): Promise<EngagementSummary> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers7d,
    activeUsers30d,
    newUsersThisWeek,
    totalTrips,
    totalActivities,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    db.trip.count(),
    db.activity.count(),
  ]);

  return {
    totalUsers,
    activeUsers7d,
    activeUsers30d,
    newUsersThisWeek,
    totalTrips,
    totalActivities,
    avgActivitiesPerTrip: totalTrips > 0 ? totalActivities / totalTrips : 0,
  };
}

async function getTimeSeries(): Promise<TimeSeriesPoint[]> {
  const since = new Date(Date.now() - TIME_SERIES_DAYS * 24 * 60 * 60 * 1000);

  // Expect this to return one row per day. If your DB layer doesn't have a
  // groupByDay helper, do this with a raw SQL query (date_trunc('day', ...))
  // or a Prisma $queryRaw call instead.
  const rows = await db.analytics.groupByDay({
    since,
    metrics: ["activeUsers", "newTrips", "activitiesLogged"],
  });

  return rows.map((row) => ({
    date: row.date,
    activeUsers: row.activeUsers,
    newTrips: row.newTrips,
    activitiesLogged: row.activitiesLogged,
  }));
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const [summary, timeSeries] = await Promise.all([
      getEngagementSummary(),
      getTimeSeries(),
    ]);

    const payload: AdminStatsResponse = { summary, timeSeries };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GET /api/admin/stats failed", err);
    return NextResponse.json(
      { error: "Failed to load admin stats" },
      { status: 500 }
    );
  }
}
