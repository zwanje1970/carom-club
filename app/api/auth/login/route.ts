import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createSession, verifyPassword } from "@/lib/auth";

const DB_ERROR_CODES = ["P1001", "P1002", "P1017", "P1033"]; // 연결 불가/끊김 등

function isDbConnectionError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    typeof err?.code === "string" && DB_ERROR_CODES.includes(err.code)
  ) || (typeof err?.message === "string" && /connect|ECONNREFUSED|timeout|database/i.test(err.message));
}

const DB_UNAVAILABLE_MSG = "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요.";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: DB_UNAVAILABLE_MSG }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { username, password, platformAdminOnly, rememberMe, clientLogin, clientMode } = body as {
      username?: string;
      password?: string;
      platformAdminOnly?: boolean;
      rememberMe?: boolean;
      clientLogin?: boolean;
      clientMode?: boolean;
    };
    const isClientLoginRequest = clientLogin === true || clientMode === true;

    if (!username?.trim() || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { username: username.trim() },
      });
    } catch (dbError) {
      console.error("[login] DB error:", dbError);
      if (isDbConnectionError(dbError)) {
        return NextResponse.json(
          { error: "데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." },
          { status: 503 }
        );
      }
      throw dbError;
    }

    if (!user) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const withdrawnAt = (user as { withdrawnAt?: Date | null }).withdrawnAt;
    const status = (user as { status?: string | null }).status;
    if (withdrawnAt || status === "DELETED") {
      return NextResponse.json(
        { error: "탈퇴한 계정입니다. 재가입 문의는 관리자에게 연락해 주세요." },
        { status: 403 }
      );
    }

    if (!user.password?.trim()) {
      console.error("[login] user has no password hash:", user.username);
      return NextResponse.json(
        { error: "계정 설정이 올바르지 않습니다. 관리자에게 문의하세요." },
        { status: 500 }
      );
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const role = String(user.role) as "USER" | "CLIENT_ADMIN" | "PLATFORM_ADMIN";
    if (platformAdminOnly && role !== "PLATFORM_ADMIN") {
      return NextResponse.json(
        { error: "플랫폼 관리자 전용 로그인입니다. 이 계정으로는 접근할 수 없습니다." },
        { status: 403 }
      );
    }
    if (isClientLoginRequest && role === "USER") {
      return NextResponse.json(
        {
          error:
            "클라이언트 계정이 아닙니다. '클라이언트로 로그인' 체크를 해제한 후 다시 로그인하세요.",
        },
        { status: 403 }
      );
    }
    const token = await createSession(
      {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role,
      },
      rememberMe ? 30 : 7
    );
    const maxAge = rememberMe
      ? 60 * 60 * 24 * 30 // 30일
      : 60 * 60 * 24 * 7; // 7일
    const res = NextResponse.json({ ok: true, role });
    res.cookies.set("carom_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    return res;
  } catch (e) {
    const err = e as Error;
    console.error("[login] error:", err?.message ?? e);
    if (process.env.NODE_ENV === "development" && err?.stack) {
      console.error("[login] stack:", err.stack);
    }
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
