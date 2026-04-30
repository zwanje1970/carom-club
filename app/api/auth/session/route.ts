import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAuthSession,
  parseSessionCookieValue,
  serializeSessionCookieValue,
  SESSION_COOKIE_NAME,
} from "../../../../lib/auth/session";
import { findUserByIdentifier, getClientStatusByUserId, getUserById } from "../../../../lib/platform-api";

export const runtime = "nodejs";

/** 로그인 POST·client-application 등과 동일한 name/path/httpOnly/sameSite/secure로 만료 Set-Cookie를 내려 보낸다. */
function clearSessionCookieOnResponse(response: NextResponse): NextResponse {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);

  if (!session) {
    return NextResponse.json({ authenticated: false, session: null });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return clearSessionCookieOnResponse(NextResponse.json({ authenticated: false, session: null }));
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  return NextResponse.json({
    authenticated: true,
    session,
    user: {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      role: user.role,
      email: user.email,
      phone: user.phone,
      clientStatus,
      linkedVenueId: user.linkedVenueId ?? null,
    },
  });
}

export async function POST(request: Request) {
  let body: { identifier?: unknown; password?: unknown; rememberMe?: unknown } = {};

  try {
    body = (await request.json()) as { identifier?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (typeof body.identifier !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "로그인 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const identifier = body.identifier.trim();
  const password = body.password.trim();
  const rememberMe = body.rememberMe === true;
  if (!identifier || !password) {
    return NextResponse.json({ error: "아이디 또는 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const user = await findUserByIdentifier(identifier);
  if (!user || user.password.trim() !== password) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  const session = createAuthSession(user.id, user.role);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, serializeSessionCookieValue(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  const clientStatus = await getClientStatusByUserId(user.id);

  return NextResponse.json({
    authenticated: true,
    session,
    user: {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      role: user.role,
      email: user.email,
      phone: user.phone,
      clientStatus,
      linkedVenueId: user.linkedVenueId ?? null,
    },
  });
}

export async function DELETE() {
  return clearSessionCookieOnResponse(NextResponse.json({ authenticated: false, session: null }));
}
