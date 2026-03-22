import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** 일반·관리자 로그인 공통 (lib/auth.ts COOKIE_NAME 과 동일) */
const SESSION_COOKIE = "carom_session";
const ADMIN_SESSION_COOKIE = SESSION_COOKIE;

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "default-secret-change-in-production")
  );
}

const SECRET = new TextEncoder().encode(getSessionSecret());

type JwtPayload = {
  role?: string;
  authChannel?: string;
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  /** `app/mypage/notes/layout.tsx` 등에서 `login?next=` 복귀 경로용 */
  requestHeaders.set("x-pathname", pathname);

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/api/auth/login" ||
    pathname.startsWith("/admin/api/auth/login");
  if (isAdminRoute && !isAdminLogin) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    try {
      const { payload } = await jwtVerify(token, SECRET);
      const raw = payload as unknown as JwtPayload;
      const authChannelRaw = raw.authChannel;
      const authChannel =
        authChannelRaw === "admin" || authChannelRaw === "client" || authChannelRaw === "user"
          ? authChannelRaw
          : "user";
      const role = raw.role;
      const allowed = role === "PLATFORM_ADMIN" && authChannel === "admin";
      if (!allowed) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  /**
   * 당구노트: 레이아웃만으로는 배포/캐시·RSC 조합에서 비회원 노출 이슈가 있을 수 있어
   * Edge에서 세션 쿠키 + JWT 검증으로 선차단 (관리자와 동일 비밀키).
   */
  const isMypageNotesRoute =
    pathname === "/mypage/notes" || pathname.startsWith("/mypage/notes/");
  if (isMypageNotesRoute) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      return res;
    }
    try {
      await jwtVerify(token, SECRET);
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      return res;
    }
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    return res;
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
