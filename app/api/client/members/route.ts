import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getUserById,
  listDeduplicatedApplicantsForClientOwner,
} from "../../../../lib/platform-api";

export const runtime = "nodejs";

/**
 * 클라이언트(승인된 CLIENT)가 만든 대회에 신청 이력이 있는 회원 목록.
 * `/api/push/send` 의 targetUserIds 허용 집합(scope: creator)과 동일한 기준.
 */
export async function GET() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (user.role !== "CLIENT") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return NextResponse.json({ error: "승인 완료된 CLIENT만 조회할 수 있습니다." }, { status: 403 });
  }

  const rows = await listDeduplicatedApplicantsForClientOwner({
    ownerUserId: user.id,
    scope: "creator",
  });

  const members = rows.map((r) => ({
    userId: r.userId,
    name: r.applicantName,
    phone: r.phone,
    pushMarketingAgreed: r.pushMarketingAgreed,
    lastAppliedAt: r.lastAppliedAt,
  }));

  return NextResponse.json({ members });
}
