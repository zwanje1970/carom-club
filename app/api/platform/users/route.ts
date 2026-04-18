import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getUserById,
  listPlatformUsersForPlatform,
  type PlatformUserStatus,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const roleRaw = url.searchParams.get("role");
  const statusRaw = url.searchParams.get("status");

  const role = roleRaw === "USER" || roleRaw === "CLIENT" || roleRaw === "PLATFORM" ? roleRaw : "all";
  const status: PlatformUserStatus | "all" =
    statusRaw === "ACTIVE" || statusRaw === "SUSPENDED" || statusRaw === "DELETED" ? statusRaw : "all";

  const items = await listPlatformUsersForPlatform({
    search,
    role,
    status,
  });
  return NextResponse.json({ items });
}
