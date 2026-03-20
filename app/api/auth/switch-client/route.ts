import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/auth";

/** 이미 로그인된 CLIENT_ADMIN이 일반회원 모드로 들어온 경우, 비밀번호 없이 클라이언트 모드로 전환 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.role !== "CLIENT_ADMIN") {
    return NextResponse.json(
      { error: "클라이언트 계정만 클라이언트 모드로 전환할 수 있습니다." },
      { status: 403 }
    );
  }
  if (session.loginMode === "client") {
    return NextResponse.json({ ok: true, loginMode: "client" });
  }

  const token = await createSession(
    {
      ...session,
      loginMode: "client",
      authChannel: "client",
      isClientAccount: true,
    },
    7
  );
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, loginMode: "client" });
}
