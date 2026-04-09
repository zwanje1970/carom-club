import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
const SESSION_COOKIE = "carom_session";

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "default-secret-change-in-production")
  );
}

/** Edge 런타임에서 매 요청마다 읽음 — 모듈 로드 시점에 빈 값이 박히는 빌드/콜드스타트 이슈 완화 */
function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

type JwtPayload = {
  role?: string;
  loginMode?: string;
};
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  console.log("MIDDLEWARE HIT:", pathname);
  console.log("MIDDLEWARE COOKIES", req.cookies.getAll());

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (!pathname.startsWith("/client")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const denied = new URL("/mypage", req.url);
    denied.searchParams.set("needClientLogin", "1");
    denied.searchParams.set("mwtest", "caromcheck");
    return NextResponse.redirect(denied);
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecretKey());
    const raw = payload as unknown as JwtPayload;
    const role = raw.role === "CLIENT_ADMIN" ? "CLIENT_ADMIN" : "OTHER";
    const loginMode = raw.loginMode === "client" ? "client" : "user";
    const canAccess = role === "CLIENT_ADMIN" && loginMode === "client";
    if (!canAccess) {
      const denied = new URL("/mypage", req.url);
      denied.searchParams.set("needClientLogin", "1");
      denied.searchParams.set("mwtest", "caromcheck");
      return NextResponse.redirect(denied);
    }
  } catch {
    const denied = new URL("/mypage", req.url);
    denied.searchParams.set("needClientLogin", "1");
    denied.searchParams.set("mwtest", "caromcheck");
    return NextResponse.redirect(denied);
  }

  return NextResponse.next();
}

/**
 * `_next/static`·`_next/image`·파비콘 등 정적 자산은 미들웨어를 건너뜀.
 * (전 경로 실행 시 RSC 청크 JS 요청이 불필요하게 Edge를 거치며 지연·타임아웃이 날 수 있음)
 */
export const config = {
  matcher: ["/client", "/client/:path*", "/admin/login", "/admin/login/:path*"],
};
