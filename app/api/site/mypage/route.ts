import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getUserById, updateUserProfile } from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return getUnauthorizedResponse();

  const user = await getUserById(session.userId);
  if (!user) return getUnauthorizedResponse();

  let body: {
    name?: unknown;
    nickname?: unknown;
    phone?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
    pushMarketingAgreed?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const nickname = typeof body.nickname === "string" ? body.nickname : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }
  }

  const pushMarketingAgreed =
    typeof body.pushMarketingAgreed === "boolean" ? body.pushMarketingAgreed : undefined;

  const result = await updateUserProfile({
    userId: user.id,
    name,
    nickname,
    phone,
    password: password || undefined,
    pushMarketingAgreed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      nickname: result.user.nickname,
      role: result.user.role,
      email: result.user.email,
      phone: result.user.phone,
      pushMarketingAgreed: result.user.pushMarketingAgreed,
    },
  });
}
