import { NextResponse } from "next/server";
import { createUser } from "../../../../lib/platform-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    loginId?: unknown;
    nickname?: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
    pushMarketingAgreed?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.pushMarketingAgreed !== true) {
    return NextResponse.json(
      { error: "대회 안내 및 이벤트 알림 수신에 동의해 주세요." },
      { status: 400 }
    );
  }

  const result = await createUser({
    loginId: typeof body.loginId === "string" ? body.loginId : "",
    nickname: typeof body.nickname === "string" ? body.nickname : "",
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    password: typeof body.password === "string" ? body.password : "",
    pushMarketingAgreed: true,
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
    },
  });
}
