import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAuthSession,
  parseSessionCookieValue,
  serializeSessionCookieValue,
  SESSION_COOKIE_NAME,
} from "../../../lib/auth/session";
import {
  createClientApplication,
  getClientStatusByUserId,
  getLatestClientApplicationByUserId,
  getUserById,
} from "../../../lib/server/dev-store";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return getUnauthorizedResponse();

  const user = await getUserById(session.userId);
  if (!user) return getUnauthorizedResponse();

  const latest = await getLatestClientApplicationByUserId(user.id);
  const clientStatus = await getClientStatusByUserId(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      clientStatus,
    },
    application: latest,
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return getUnauthorizedResponse();

  const user = await getUserById(session.userId);
  if (!user) return getUnauthorizedResponse();
  if (user.role === "PLATFORM") {
    return NextResponse.json({ error: "플랫폼 계정은 신청 대상이 아닙니다." }, { status: 400 });
  }

  let body: {
    organizationName?: unknown;
    contactName?: unknown;
    contactPhone?: unknown;
    requestedClientType?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const result = await createClientApplication({
    userId: user.id,
    organizationName: typeof body.organizationName === "string" ? body.organizationName : "",
    contactName: typeof body.contactName === "string" ? body.contactName : "",
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
    requestedClientType: body.requestedClientType === "REGISTERED" ? "REGISTERED" : "GENERAL",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 신청 저장 시점부터 CLIENT 역할로 세션을 갱신한다.
  const refreshedSession = createAuthSession(user.id, "CLIENT");
  cookieStore.set(SESSION_COOKIE_NAME, serializeSessionCookieValue(refreshedSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({
    ok: true,
    application: result.application,
    session: refreshedSession,
  });
}
