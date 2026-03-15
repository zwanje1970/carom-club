/** 사용자 역할: USER(일반), CLIENT_ADMIN(클라이언트 관리자), PLATFORM_ADMIN(플랫폼 관리자), ZONE_MANAGER(권역 관리자) */
export type UserRole = "USER" | "CLIENT_ADMIN" | "PLATFORM_ADMIN" | "ZONE_MANAGER";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export function isPlatformAdmin(session: SessionUser | null): boolean {
  return session?.role === "PLATFORM_ADMIN";
}

export function isClientAdmin(session: SessionUser | null): boolean {
  return session?.role === "CLIENT_ADMIN";
}

export function isAdmin(session: SessionUser | null): boolean {
  return isPlatformAdmin(session) || isClientAdmin(session);
}
