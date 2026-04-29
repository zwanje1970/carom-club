import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getUserById, permanentlyDeleteTournamentPublishedCardBySnapshotIdForPlatformBackup } from "../../../../../../../../lib/platform-api";
import { readPermanentDeleteConfirmText } from "../../../../../../../../lib/server/read-permanent-delete-confirm-text";

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

export async function POST(request: Request, context: { params: Promise<{ snapshotId: string }> }) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "플랫폼 관리자만 완전 삭제할 수 있습니다." }, { status: 403 });
  const { snapshotId } = await context.params;
  const sid = typeof snapshotId === "string" ? snapshotId.trim() : "";
  if (!sid) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const confirmText = readPermanentDeleteConfirmText(body);

  const result = await permanentlyDeleteTournamentPublishedCardBySnapshotIdForPlatformBackup(sid, confirmText);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
