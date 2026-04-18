import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  createReannounceNotifications,
  getClientStatusByUserId,
  getUserById,
  listDeduplicatedApplicantsForClientOwner,
} from "../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let scope: "creator" | "platform";
  if (user.role === "PLATFORM") {
    scope = "platform";
  } else if (user.role === "CLIENT") {
    const clientStatus = await getClientStatusByUserId(user.id);
    if (clientStatus !== "APPROVED") {
      return NextResponse.json({ error: "승인 완료된 CLIENT만 발송할 수 있습니다." }, { status: 403 });
    }
    scope = "creator";
  } else {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { title?: unknown; body?: unknown; targetUserIds?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const messageBody = typeof body.body === "string" ? body.body : "";
  const targetUserIds = Array.isArray(body.targetUserIds)
    ? body.targetUserIds.map((x) => (typeof x === "string" ? x : String(x ?? "")))
    : [];

  if (!title.trim() || !messageBody.trim()) {
    return NextResponse.json({ error: "제목과 내용을 모두 입력해 주세요." }, { status: 400 });
  }
  if (targetUserIds.length === 0) {
    return NextResponse.json({ error: "수신자를 한 명 이상 선택해 주세요." }, { status: 400 });
  }

  const allowed = await listDeduplicatedApplicantsForClientOwner({
    ownerUserId: user.id,
    scope,
  });
  const allowedSet = new Set(allowed.map((r) => r.userId));
  const normalizedTargets = [...new Set(targetUserIds.map((id) => id.trim()).filter(Boolean))];
  for (const id of normalizedTargets) {
    if (!allowedSet.has(id)) {
      return NextResponse.json({ error: "선택한 수신자 중 허용되지 않은 대상이 포함되었습니다." }, { status: 403 });
    }
  }

  const result = await createReannounceNotifications({
    targetUserIds: normalizedTargets,
    title,
    message: messageBody,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sent: result.count });
}
