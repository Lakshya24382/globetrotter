"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import UserManagementTable from "@/components/admin/UserManagementTable";
import type { AdminUser, AdminUserRole, AdminUserStatus } from "@/types/admin";

interface UserManagementSectionProps {
  initialUsers: AdminUser[];
}

export default function UserManagementSection({
  initialUsers,
}: UserManagementSectionProps) {
  const [users, setUsers] = useState(initialUsers);
  const router = useRouter();

  async function patchUser(id: string, body: { role?: AdminUserRole; status?: AdminUserStatus }) {
    const previous = users;
    // Optimistic update.
    setUsers((current) =>
      current.map((u) => (u.id === id ? { ...u, ...body } : u))
    );

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Roll back on failure.
      setUsers(previous);
      const { error } = await res.json().catch(() => ({ error: "Update failed" }));
      alert(error ?? "Update failed");
      return;
    }

    router.refresh();
  }

  return (
    <UserManagementTable
      users={users}
      onRoleChange={(id, role) => patchUser(id, { role })}
      onStatusChange={(id, status) => patchUser(id, { status })}
    />
  );
}
