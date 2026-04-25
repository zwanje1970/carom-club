import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getUserById,
  listApprovedClientOrganizations,
  type ClientOrganizationStatus,
  type ClientOrganizationType,
} from "../../../../lib/platform-api";

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
  const statusRaw = url.searchParams.get("status");
  const typeRaw = url.searchParams.get("type");
  const status: ClientOrganizationStatus | "all" =
    statusRaw === "ACTIVE" || statusRaw === "SUSPENDED" || statusRaw === "EXPELLED" ? statusRaw : "all";
  const clientType: ClientOrganizationType | "all" =
    typeRaw === "GENERAL" || typeRaw === "REGISTERED" ? typeRaw : "all";
  const items = await listApprovedClientOrganizations({ status, clientType });
  return NextResponse.json({ items });
}
