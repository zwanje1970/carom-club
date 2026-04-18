import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getUserById,
  patchPlatformUserForPlatform,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { userId } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updated = await patchPlatformUserForPlatform(userId, {
    role: body.role === "USER" || body.role === "CLIENT" || body.role === "PLATFORM" ? body.role : undefined,
    status:
      body.status === "ACTIVE" || body.status === "SUSPENDED" || body.status === "DELETED"
        ? body.status
        : undefined,
    orgClientType: body.orgClientType === "GENERAL" || body.orgClientType === "REGISTERED" ? body.orgClientType : undefined,
    orgApprovalStatus:
      body.orgApprovalStatus === "PENDING" || body.orgApprovalStatus === "APPROVED" || body.orgApprovalStatus === "REJECTED"
        ? body.orgApprovalStatus
        : undefined,
  });
  if (!updated) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true, item: updated });
}
