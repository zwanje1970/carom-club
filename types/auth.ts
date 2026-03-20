/** 사용자 역할: USER(일반), CLIENT_ADMIN(클라이언트 관리자), PLATFORM_ADMIN(플랫폼 관리자), ZONE_MANAGER(권역 관리자) */
export type UserRole = "USER" | "MODERATOR" | "CLIENT_ADMIN" | "PLATFORM_ADMIN" | "ZONE_MANAGER";

/** 로그인 모드: 체크박스 기준. user=일반회원, client=클라이언트 대시보드 */
export type LoginMode = "user" | "client";

/** 로그인 경로: 일반(/login)=user, 관리자(/admin/login)=admin, 클라이언트 전환=client. 구버전 JWT에 없으면 user로만 간주 */
export type AuthChannel = "user" | "admin" | "client";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  /** 로그인 시 선택한 모드. 클라이언트 계정이라도 체크 안 하면 "user" */
  loginMode: LoginMode;
  /** DB상 클라이언트 계정 여부. 권한 부여는 loginMode 기준으로만 함 */
  isClientAccount: boolean;
  /** 관리자 콘솔은 authChannel === "admin" 일 때만 (일반 로그인으로는 PLATFORM_ADMIN이어도 user 채널) */
  authChannel: AuthChannel;
}

export function isPlatformAdmin(session: SessionUser | null): boolean {
  return session?.role === "PLATFORM_ADMIN" && session?.authChannel === "admin";
}

export function isClientAdmin(session: SessionUser | null): boolean {
  return session?.role === "CLIENT_ADMIN";
}

/** 세션의 로그인 모드가 클라이언트인지. 클라이언트 대시보드 접근은 이 값으로만 판단 */
export function isClientLoginMode(session: SessionUser | null): boolean {
  return session?.loginMode === "client";
}

/** 클라이언트 대시보드 접근 가능: CLIENT_ADMIN + 로그인 시 '클라이언트로 로그인' 체크 */
export function canAccessClientDashboard(session: SessionUser | null): boolean {
  return session?.role === "CLIENT_ADMIN" && session?.loginMode === "client";
}

export function isAdmin(session: SessionUser | null): boolean {
  return isPlatformAdmin(session) || isClientAdmin(session);
}
