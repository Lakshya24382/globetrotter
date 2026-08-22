import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import type { AdminUser, AdminUserRole, AdminUserStatus } from "@/types/admin";

const VALID_ROLES: AdminUserRole[] = ["user", "admin"];
const VALID_STATUSES: AdminUserStatus[] = ["active", "suspended", "invited"];

interface PatchBody {
  role?: AdminUserRole;
  status?: AdminUserStatus;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = params;
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.role === undefined && body.status === undefined) {
    return NextResponse.json(
      { error: "Provide at least one of: role, status" },
      { status: 400 }
    );
  }

  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Prevent an admin from locking themselves out by demoting/suspending their
  // own account through this endpoint.
  if (id === guard.actor.id && (body.role === "user" || body.status === "suspended")) {
    return NextResponse.json(
      { error: "You can't change your own role or suspend yourself" },
      { status: 400 }
    );
  }

  try {
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastActiveAt: true,
        createdAt: true,
        _count: { select: { trips: true } },
      },
    });

    const payload: AdminUser = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      tripCount: updated._count.trips,
      lastActiveAt: updated.lastActiveAt ? updated.lastActiveAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error(`PATCH /api/admin/users/${id} failed`, err);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
