import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_SESSION_COOKIE = "carom_session";

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

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
