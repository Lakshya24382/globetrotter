import type { EngagementSummary } from "@/types/admin";

interface StatsOverviewProps {
  summary: EngagementSummary;
}

interface MetricCard {
  label: string;
  value: string;
  hint?: string;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function StatsOverview({ summary }: StatsOverviewProps) {
  const cards: MetricCard[] = [
    {
      label: "Total users",
      value: formatNumber(summary.totalUsers),
      hint: `+${formatNumber(summary.newUsersThisWeek)} this week`,
    },
    {
      label: "Active (7d)",
      value: formatNumber(summary.activeUsers7d),
    },
    {
      label: "Active (30d)",
      value: formatNumber(summary.activeUsers30d),
    },
    {
      label: "Total trips",
      value: formatNumber(summary.totalTrips),
    },
    {
      label: "Activities logged",
      value: formatNumber(summary.totalActivities),
    },
    {
      label: "Avg activities / trip",
      value: summary.avgActivitiesPerTrip.toFixed(1),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {card.value}
          </p>
          {card.hint && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              {card.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
