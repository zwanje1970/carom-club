import { NextRequest, NextResponse } from "next/server";
import {
  canAccessClient,
  canAccessPlatform,
  parseSessionCookieValue,
  SESSION_COOKIE_NAME,
} from "./lib/auth/session";
import { isCaromClubMobileAppShell } from "./lib/is-carom-club-mobile-app-shell";
import { logPlatformApiBlock } from "./lib/server/platform-api-block-log";

function getLoginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

function getUnauthorizedRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/unauthorized";
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/** 예전 단일 경로만 목록으로 보냄. `/client/settlement`·`/client/settlement/*`는 현행 정산 화면이다. */
function isLegacyClientPath(pathname: string): boolean {
  return pathname.startsWith("/client/bracket") || pathname.startsWith("/client/participants");
}

export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  // 페이지빌더 iframe 미리보기(/site/preview) — 레이아웃에서 헤더/푸터 분기용(하드코딩 경로 문자열 없이 경로만 사용)
  if (pathname === "/site/preview" || pathname.startsWith("/site/preview/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-site-builder-preview", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(sessionCookie);

  if (pathname.startsWith("/api/platform")) {
    const method = request.method;
    if (!session) {
      logPlatformApiBlock("blocked_platform_api_unauthenticated", { path: pathname, method, userId: null });
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if (isCaromClubMobileAppShell(request.headers)) {
      logPlatformApiBlock("blocked_platform_api_from_app", {
        path: pathname,
        method,
        userId: session.userId,
      });
      return NextResponse.json(
        { error: "플랫폼 관리 기능은 웹 브라우저에서만 사용할 수 있습니다." },
        { status: 403 },
      );
    }
    if (!canAccessPlatform(session.role)) {
      logPlatformApiBlock("blocked_platform_api_non_platform_role", {
        path: pathname,
        method,
        userId: session.userId,
      });
      return NextResponse.json({ error: "플랫폼 관리자만 접근할 수 있습니다." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (!session) {
    return getLoginRedirect(request);
  }

  if (pathname.startsWith("/api/client")) {
    if (session.role === "PLATFORM") {
      return NextResponse.json({ error: "Client API is not available for platform accounts." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/client-apply") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/client")) {
    if (session.role === "PLATFORM") {
      const url = request.nextUrl.clone();
      url.pathname = "/platform";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (!canAccessClient(session.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/client-apply";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/platform")) {
    if (isCaromClubMobileAppShell(request.headers)) {
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("from", pathname);
      url.searchParams.set("reason", "app_platform_web_only");
      return NextResponse.redirect(url);
    }
    if (!canAccessPlatform(session.role)) {
      return getUnauthorizedRedirect(request);
    }
    return NextResponse.next();
  }

  if (isLegacyClientPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/client/tournaments";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/client/:path*",
    "/platform/:path*",
    "/client-apply",
    "/site/preview",
    "/site/preview/:path*",
    "/api/client",
    "/api/client/:path*",
    "/api/platform",
    "/api/platform/:path*",
  ],
};
