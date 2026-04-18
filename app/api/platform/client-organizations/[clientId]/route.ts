import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getClientOrganizationByIdForPlatform,
  getUserById,
  patchClientOrganizationForPlatform,
} from "../../../../../lib/server/dev-store";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> }
) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { clientId } = await context.params;
  const item = await getClientOrganizationByIdForPlatform(clientId);
  if (!item) return NextResponse.json({ error: "클라이언트를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clientId: string }> }
) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { clientId } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const updated = await patchClientOrganizationForPlatform(clientId, {
    status:
      body.status === "ACTIVE" || body.status === "SUSPENDED" || body.status === "EXPELLED"
        ? body.status
        : undefined,
    clientType: body.clientType === "GENERAL" || body.clientType === "REGISTERED" ? body.clientType : undefined,
    membershipType: body.membershipType === "NONE" || body.membershipType === "ANNUAL" ? body.membershipType : undefined,
    membershipExpireAt:
      typeof body.membershipExpireAt === "string" || body.membershipExpireAt === null
        ? (body.membershipExpireAt as string | null)
        : undefined,
    adminRemarks:
      typeof body.adminRemarks === "string" || body.adminRemarks === null
        ? (body.adminRemarks as string | null)
        : undefined,
  });
  if (!updated) return NextResponse.json({ error: "클라이언트를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true, item: updated });
}
