import { NextResponse } from "next/server";
// Swap this import for however your app currently resolves the logged-in user
// (the same helper your middleware auth check is built on).
import { getCurrentUser } from "@/lib/auth";

export interface AdminActor {
  id: string;
  role: "user" | "admin";
}

/**
 * Server-side admin guard for API routes.
 * Middleware only checks that a request is authenticated, not that the user
 * is an admin — every /api/admin/* route must call this itself.
 */
export async function requireAdmin(): Promise
  { ok: true; actor: AdminActor } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, actor: { id: user.id, role: user.role } };
}
