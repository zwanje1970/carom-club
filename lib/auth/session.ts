import { AuthRole, isAuthRole } from "./roles";

export const SESSION_COOKIE_NAME = "v3_session";

export type AuthSession = {
  userId: string;
  role: AuthRole;
};

export function createAuthSession(userId: string, role: AuthRole): AuthSession {
  return {
    userId,
    role,
  };
}

export function serializeSessionCookieValue(session: AuthSession): string {
  return encodeURIComponent(JSON.stringify(session));
}

export function parseSessionCookieValue(rawValue?: string | null): AuthSession | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as {
      userId?: unknown;
      role?: unknown;
    };

    if (typeof parsed.userId !== "string") return null;
    if (!isAuthRole(parsed.role)) return null;

    return {
      userId: parsed.userId,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function canAccessClient(role: AuthRole): boolean {
  return role === "CLIENT";
}

export function canAccessPlatform(role: AuthRole): boolean {
  return role === "PLATFORM";
}
