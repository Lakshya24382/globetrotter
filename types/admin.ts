// Shared types for the admin dashboard.
// These mirror the response shapes of GET /api/admin/stats and GET /api/admin/users.

export interface EngagementSummary {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  newUsersThisWeek: number;
  totalTrips: number;
  totalActivities: number;
  avgActivitiesPerTrip: number;
}

export interface TimeSeriesPoint {
  date: string; // ISO date, e.g. "2026-08-15"
  activeUsers: number;
  newTrips: number;
  activitiesLogged: number;
}

export interface AdminStatsResponse {
  summary: EngagementSummary;
  timeSeries: TimeSeriesPoint[];
}

export type AdminUserRole = "user" | "admin";
export type AdminUserStatus = "active" | "suspended" | "invited";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  tripCount: number;
  lastActiveAt: string | null; // ISO datetime, null if never active
  createdAt: string; // ISO datetime
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}
