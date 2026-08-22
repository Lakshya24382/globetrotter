"use client";

import { useMemo, useState } from "react";
import type { AdminUser, AdminUserRole, AdminUserStatus } from "@/types/admin";

interface UserManagementTableProps {
  users: AdminUser[];
  onRoleChange?: (userId: string, role: AdminUserRole) => void;
  onStatusChange?: (userId: string, status: AdminUserStatus) => void;
}

type SortKey = "name" | "tripCount" | "lastActiveAt" | "createdAt";
type SortDir = "asc" | "desc";

const statusStyles: Record<AdminUserStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  invited: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function UserManagementTable({
  users,
  onRoleChange,
  onStatusChange,
}: UserManagementTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      : users;

    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "tripCount") cmp = a.tripCount - b.tripCount;
      else {
        const aVal = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
        const bVal = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
        cmp = aVal - bVal;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [users, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Users ({filtered.length})
        </h3>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("name")}>
                User{sortIndicator("name")}
              </th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("tripCount")}>
                Trips{sortIndicator("tripCount")}
              </th>
              <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("lastActiveAt")}>
                Last active{sortIndicator("lastActiveAt")}
              </th>
              <th className="cursor-pointer select-none px-4 py-2" onClick={() => toggleSort("createdAt")}>
                Joined{sortIndicator("createdAt")}
              </th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-slate-50">{u.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => onRoleChange?.(u.id, e.target.value as AdminUserRole)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[u.status]}`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">{u.tripCount}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {formatRelative(u.lastActiveAt)}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {new Date(u.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.status === "suspended" ? (
                    <button
                      onClick={() => onStatusChange?.(u.id, "active")}
                      className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => onStatusChange?.(u.id, "suspended")}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No users match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
