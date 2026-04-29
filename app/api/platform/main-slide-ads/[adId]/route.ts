import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getUserById, softDeleteMainSlideAdByIdForPlatform } from "../../../../../lib/platform-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function DELETE(_request: Request, context: { params: Promise<{ adId: string }> }) {
  const user = await requirePlatformUser();
  if (!user) {
    return NextResponse.json({ error: "플랫폼 관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const { adId } = await context.params;
  const id = typeof adId === "string" ? adId.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await softDeleteMainSlideAdByIdForPlatform({ adId: id, deletedBy: user.id });
  if (!result.ok) {
    const status = result.error === "광고를 찾을 수 없습니다." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
