import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/types/auth";

const COOKIE_NAME = "carom_session";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "default-secret-change-in-production");
}

const SECRET = new TextEncoder().encode(getSessionSecret());

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashed: string
): Promise<boolean> {
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
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${expiresInDays}d`)
    .setIssuedAt()
    .sign(SECRET);
}

export async function getSession(): Promise<SessionUser | null> {
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
    return {
      id: String(raw.id),
      name: String(raw.name),
      username: String(raw.username),
      email: String(raw.email),
      role,
      loginMode,
      isClientAccount,
      authChannel,
    } as SessionUser;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
