import type { NextResponse } from "next/server";
import { cache } from "react";
import type { SessionUser } from "@/types/auth";

const COOKIE_NAME = "carom_session";

/**
 * apex(예: carom.club)와 www(www.carom.club)를 함께 쓸 때 세션 공유.
 * Vercel 환경변수 예: SESSION_COOKIE_DOMAIN=.carom.club
 * (호스트만 넣어도 됨 — 앞의 점은 선택)
 */
export type SessionCookieSetOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
};

export function getSessionCookieOptions(maxAgeSeconds: number): SessionCookieSetOptions {
  const secure = process.env.NODE_ENV === "production";
  const raw = process.env.SESSION_COOKIE_DOMAIN?.trim();
  let domain: string | undefined;
  if (raw && !/^localhost$/i.test(raw)) {
    const host = raw.replace(/^\./, "");
    domain = `.${host}`;
  }
  const opts: SessionCookieSetOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
  if (domain) opts.domain = domain;
  return opts;
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "default-secret-change-in-production");
}

const SECRET = new TextEncoder().encode(getSessionSecret());

export async function hashPassword(password: string): Promise<string> {
  const { default: bcrypt } = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashed: string
): Promise<boolean> {
  const { default: bcrypt } = await import("bcryptjs");
  return bcrypt.compare(password, hashed);
}

/** @param expiresInDays 기본 7일, 자동로그인 시 30일 등으로 설정 */
export async function createSession(
  user: SessionUser,
  expiresInDays: number = 7
): Promise<string> {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production. Set it in your environment.");
  }
  const { SignJWT } = await import("jose");
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${expiresInDays}d`)
    .setIssuedAt()
    .sign(SECRET);
}

async function getSessionUncached(): Promise<SessionUser | null> {
  const { cookies } = await import("next/headers");
  const { jwtVerify } = await import("jose");
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const raw = payload as unknown as Record<string, unknown>;
    const loginMode = (raw.loginMode as SessionUser["loginMode"]) ?? "user";
    const authChannelRaw = raw.authChannel;
    const authChannel: SessionUser["authChannel"] =
      authChannelRaw === "admin" || authChannelRaw === "client" || authChannelRaw === "user"
        ? authChannelRaw
        : "user";
    let role = raw.role as SessionUser["role"];
    if (role === "PLATFORM_ADMIN" && authChannel !== "admin") {
      role = "USER";
    }
    const isClientAccount =
      typeof raw.isClientAccount === "boolean" ? raw.isClientAccount : role === "CLIENT_ADMIN";
    const roleId =
      typeof raw.roleId === "string" ? raw.roleId : raw.roleId === null ? null : null;
    return {
      id: String(raw.id),
      name: String(raw.name),
      username: String(raw.username),
      email: String(raw.email),
      role,
      roleId,
      loginMode,
      isClientAccount,
      authChannel,
    } as SessionUser;
  } catch {
    return null;
  }
}

/** 동일 RSC 요청에서 중복 호출 시 JWT 검증 한 번만 수행 */
export const getSession = cache(getSessionUncached);

export async function setSessionCookie(token: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getSessionCookieOptions(60 * 60 * 24 * 7));
}

/** Route Handler 응답에 세션 쿠키 부착 — 옵션은 getSessionCookieOptions 단일 경로 */
export function setSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  res.cookies.set(COOKIE_NAME, token, getSessionCookieOptions(maxAgeSeconds));
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const opts = getSessionCookieOptions(0);
  if (opts.domain) {
    cookieStore.set(COOKIE_NAME, "", { ...opts, maxAge: 0 });
  } else {
    cookieStore.delete(COOKIE_NAME);
  }
}

export { COOKIE_NAME };
