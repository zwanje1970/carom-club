import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  settlementApiCheckClientFeatureAccess,
  settlementApiGetSessionUser,
} from "../../../../../lib/server/settlement-api-auth-firestore";
import { getSettlementLedgerOverviewForClientFirestore } from "../../../../../lib/server/firestore-tournament-settlements";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await settlementApiGetSessionUser(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (user.role === "PLATFORM") {
    const result = await getSettlementLedgerOverviewForClientFirestore({
      userId: user.id,
      role: "PLATFORM",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  }

  if (user.role !== "CLIENT") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const gate = await settlementApiCheckClientFeatureAccess({ userId: user.id, feature: "SETTLEMENT" });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  const result = await getSettlementLedgerOverviewForClientFirestore({
    userId: user.id,
    role: "CLIENT",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
