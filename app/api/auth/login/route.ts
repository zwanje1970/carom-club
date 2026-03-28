import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  clearSessionCookie,
  createSession,
  setSessionCookieOnResponse,
  verifyPassword,
} from "@/lib/auth";

const DB_ERROR_CODES = ["P1001", "P1002", "P1017", "P1033", "P2024"]; // 연결 불가/끊김/풀 타임아웃
const DB_SCHEMA_MISMATCH_CODE = "P2022"; // 컬럼 없음 (schema와 DB 불일치)

function isDbConnectionError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    typeof err?.code === "string" && DB_ERROR_CODES.includes(err.code)
  ) || (typeof err?.message === "string" && /connect|ECONNREFUSED|timeout|database/i.test(err.message));
}

function isDbSchemaMismatchError(e: unknown): boolean {
  const err = e as { code?: string };
  return err?.code === DB_SCHEMA_MISMATCH_CODE;
}

const DB_UNAVAILABLE_MSG = "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요.";

/** 연결 오류 시 재시도 (Neon 콜드스타트 등). 최대 5회, 간격 0/0.8/2/3/4초 */
async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [0, 800, 2000, 3000, 4000];
  let lastError: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const err = e as { code?: string };
      if (!isDbConnectionError(e) || i === delays.length - 1) throw e;
      console.warn("[login] DB connection retry", i + 1, "/", delays.length, err?.code ?? "");
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: DB_UNAVAILABLE_MSG }, { status: 503 });
  }
  try {
    // 기존 세션 제거 (이전 관리자/다른 계정 쿠키가 새 로그인에 섞이지 않도록)
    await clearSessionCookie();

    const body = await request.json();
    const { username, password, rememberMe, isClientLogin } = body as {
      username?: string;
      password?: string;
      platformAdminOnly?: boolean;
      rememberMe?: boolean;
      /** 클라이언트로 로그인 체크 시 true. 이 값으로만 client 모드 허용 */
      isClientLogin?: boolean;
    };
    const isClientLoginRequest = isClientLogin === true;

    const { pathname } = new URL(request.url);
    // authChannel은 이 요청의 URL 경로만 사용 (platformAdminOnly 등 body 값으로 결정하지 않음).
    // 관리자 로그인은 /admin/... API로 POST 해야 pathname이 /admin 으로 시작함 (예: /admin/api/auth/login).
    const isAdminLogin = pathname.startsWith("/admin");

    if (!username?.trim() || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 로그인에서 실제 사용 필드만 select (P2022 방지: DB에 없는 컬럼 미요청)
    const loginSelect = {
      id: true,
      name: true,
      username: true,
      email: true,
      password: true,
      role: true,
      roleId: true,
      status: true,
      withdrawnAt: true,
    } as const;
    const minimalSelect = {
      id: true,
      name: true,
      username: true,
      email: true,
      password: true,
      role: true,
    } as const;

    type LoginUser = {
      id: string;
      name: string;
      username: string;
      email: string;
      password: string;
      role: string;
      roleId?: string | null;
      status?: string | null;
      withdrawnAt?: Date | null;
    };

    let user: LoginUser | null;
    try {
      user = await withDbRetry(() =>
        prisma.user.findUnique({
          where: { username: username.trim() },
          select: loginSelect,
        })
      );
    } catch (dbError) {
      const err = dbError as { code?: string; message?: string; meta?: unknown };
      console.error("[login] DB error:", dbError);
      console.error("[login] DB error.code:", err?.code);
      console.error("[login] DB error.message:", err?.message);
      console.error("[login] DB error.meta (전체):", JSON.stringify(err?.meta ?? null, null, 2));
      if (typeof err?.meta === "object" && err.meta !== null && "column" in err.meta) {
        console.error("[login] DB error.meta.column (없는 컬럼):", (err.meta as { column?: unknown }).column);
      }
      if (isDbSchemaMismatchError(dbError)) {
        // P2022 시 최소 필드만으로 재시도 (status/withdrawnAt 없을 때)
        console.warn("[login] P2022: 최소 필드(id,name,username,email,password,role)로 재시도");
        try {
          const fallbackUser = await prisma.user.findUnique({
            where: { username: username.trim() },
            select: minimalSelect,
          });
          user =
            fallbackUser != null
              ? { ...fallbackUser, roleId: null, status: null, withdrawnAt: null }
              : null;
        } catch (fallbackError) {
          const fe = fallbackError as { code?: string; meta?: unknown };
          console.error("[login] fallback also failed:", fallbackError);
          console.error("[login] fallback error.meta:", JSON.stringify(fe?.meta ?? null, null, 2));
          return NextResponse.json(
            {
              error:
                "데이터베이스 스키마가 일치하지 않습니다. 터미널에서 npx prisma generate 후 npx prisma db push 또는 npx prisma migrate deploy 를 실행해 주세요.",
            },
            { status: 503 }
          );
        }
      } else if (isDbConnectionError(dbError)) {
        return NextResponse.json(
          { error: "데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." },
          { status: 503 }
        );
      } else {
        throw dbError;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const withdrawnAt = user.withdrawnAt ?? null;
    const status = user.status ?? null;
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

    const dbRole = String(user.role) as "USER" | "CLIENT_ADMIN" | "PLATFORM_ADMIN" | "ZONE_MANAGER";
    if (isAdminLogin && dbRole !== "PLATFORM_ADMIN") {
      return NextResponse.json(
        { error: "플랫폼 관리자 전용 로그인입니다. 이 계정으로는 접근할 수 없습니다." },
        { status: 403 }
      );
    }
    // 일반 로그인에서는 플랫폼 관리자 계정 사용 불가 (관리자 전용 URL에서만 로그인)
    if (!isAdminLogin && dbRole === "PLATFORM_ADMIN") {
      return NextResponse.json(
        {
          error:
            "플랫폼 관리자 계정은 일반 로그인을 사용할 수 없습니다. 관리자 로그인(/admin/login)에서 로그인해 주세요.",
        },
        { status: 403 }
      );
    }
    if (isClientLoginRequest && dbRole === "USER") {
      return NextResponse.json(
        {
          error:
            "클라이언트 계정이 아닙니다. '클라이언트로 로그인' 체크를 해제한 후 다시 로그인하세요.",
        },
        { status: 403 }
      );
    }
    const isClientAccount = dbRole === "CLIENT_ADMIN";
    const authChannel = isAdminLogin
      ? "admin"
      : isClientAccount && isClientLoginRequest
        ? "client"
        : "user";
    const effectiveRole =
      !isAdminLogin && dbRole === "PLATFORM_ADMIN" ? "USER" : dbRole;
    const loginMode = isClientAccount && isClientLoginRequest ? "client" : "user";

    const token = await createSession(
      {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: effectiveRole,
        roleId: user.roleId ?? null,
        loginMode,
        authChannel,
        isClientAccount,
      },
      rememberMe ? 30 : 7
    );
    const maxAge = rememberMe
      ? 60 * 60 * 24 * 30 // 30일
      : 60 * 60 * 24 * 7; // 7일
    const res = NextResponse.json({ ok: true, role: effectiveRole, loginMode, authChannel });
    setSessionCookieOnResponse(res, token, maxAge);
    return res;
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    console.error("[login] unhandled error:", err?.message ?? e);
    console.error("[login] error name:", err?.name);
    console.error("[login] error code:", err?.code);
    console.error("[login] error meta:", err?.meta != null ? JSON.stringify(err.meta, null, 2) : undefined);
    console.error("[login] full error object:", e);
    if (process.env.NODE_ENV === "development" && err?.stack) {
      console.error("[login] stack:", err.stack);
    }
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
