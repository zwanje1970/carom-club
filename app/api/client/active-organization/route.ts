import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  CLIENT_CONSOLE_ORG_COOKIE,
  getClientConsoleOrgCookieOptions,
  userCanAccessOrganizationForClientConsole,
} from "@/lib/client-console-org.server";
import { canAccessClientDashboard } from "@/types/auth";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 운영 콘솔에서 선택한 조직을 쿠키에 저장합니다.
 * HttpOnly · Path=/client
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { organizationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const organizationId = body.organizationId?.trim();
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId가 필요합니다." }, { status: 400 });
  }

  const ok = await userCanAccessOrganizationForClientConsole(session.id, organizationId);
  if (!ok) {
    return NextResponse.json({ error: "해당 조직에 접근할 수 없습니다." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, organizationId });
  res.cookies.set(
    CLIENT_CONSOLE_ORG_COOKIE,
    organizationId,
    getClientConsoleOrgCookieOptions(ONE_YEAR)
  );
  return res;
}
