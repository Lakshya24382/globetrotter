import StatsOverview from "@/components/admin/StatsOverview";
import EngagementChart from "@/components/admin/EngagementChart";
import UserManagementSection from "@/components/admin/UserManagementSection";
import type { AdminStatsResponse, AdminUsersResponse } from "@/types/admin";

// Server component: fetches stats + first page of users on the server.
// Adjust the base URL / auth headers to match how your app calls its own API routes.
async function getStats(): Promise<AdminStatsResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stats`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load admin stats");
  return res.json();
}

async function getUsers(): Promise<AdminUsersResponse> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/users?page=1&pageSize=50`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load users");
  return res.json();
}

export default async function AdminPage() {
  const [stats, usersResponse] = await Promise.all([getStats(), getUsers()]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Admin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Engagement metrics and user management for Globe Trotter.
          </p>
        </div>

        <StatsOverview summary={stats.summary} />
        <EngagementChart data={stats.timeSeries} />
        <UserManagementSection initialUsers={usersResponse.users} />
      </div>
    </div>
  );
}
