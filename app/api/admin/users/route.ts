import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import type { AdminUsersResponse } from "@/types/admin";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE))
  );
  const search = searchParams.get("search")?.trim() ?? "";

  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      db.user.count({ where }),
    ]);

    const payload: AdminUsersResponse = {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        tripCount: u._count.trips,
        lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("GET /api/admin/users failed", err);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}
