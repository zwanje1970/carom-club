/**
 * 공통 권한 유틸 — 역할/조직/대회/권역 조회·실무 판단.
 *
 * 우선순위 정리:
 * - 클라이언트(CLIENT_ADMIN): 대회 생성, 참가자 관리, 입금확인, 대진표 생성·강제수정 (자기 조직 대회만).
 * - 플랫폼(PLATFORM_ADMIN): 전체 대회 모니터링, 전체 클라이언트 관리, 필요 시 전체 대회 데이터 수정 가능.
 * - 대회 생성(POST)은 canManageOrganization → CLIENT_ADMIN만. 수정/참가자/대진은 canManageTournament → CLIENT_ADMIN(자기 조직) + PLATFORM_ADMIN(전체).
 */
import type { SessionUser, UserRole } from "@/types/auth";

// ---------------------------------------------------------------------------
// 타입: 권한 판단에 필요한 최소 필드 (Prisma 모델과 호환)
// ---------------------------------------------------------------------------

export interface OrgLike {
  id?: string;
  ownerUserId?: string | null;
  approvalStatus?: string | null;
  clientType?: string | null;
  membershipType?: string | null;
}

export interface TournamentLike {
  id?: string;
  organizationId?: string;
  organization?: OrgLike | null;
}

export type UserLike = Pick<SessionUser, "id" | "role"> & { role: UserRole };

function getUserRole(user: UserLike | null | undefined): UserRole | undefined {
  return user?.role;
}

// ---------------------------------------------------------------------------
// 1. 기본 role 체크 (null/undefined 안전)
// ---------------------------------------------------------------------------

export function isPlatformAdmin(user: UserLike | null | undefined): boolean {
  return getUserRole(user) === "PLATFORM_ADMIN";
}

export function isClientAdmin(user: UserLike | null | undefined): boolean {
  return getUserRole(user) === "CLIENT_ADMIN";
}

export function isZoneManager(user: UserLike | null | undefined): boolean {
  return getUserRole(user) === "ZONE_MANAGER";
}

export function isUser(user: UserLike | null | undefined): boolean {
  return getUserRole(user) === "USER";
}

// ---------------------------------------------------------------------------
// 2. Organization 기준 체크 (approvalStatus, clientType, membershipType)
// ---------------------------------------------------------------------------

/** 승인된 클라이언트(업체)인지: approvalStatus === "APPROVED" */
export function isApprovedClient(org: OrgLike | null | undefined): boolean {
  return org?.approvalStatus === "APPROVED";
}

/** 등록업체인지: clientType === "REGISTERED" */
export function isRegisteredClient(org: OrgLike | null | undefined): boolean {
  return org?.clientType === "REGISTERED";
}

/** 연회원 적용 업체인지: membershipType === "ANNUAL" */
export function isAnnualClient(org: OrgLike | null | undefined): boolean {
  return org?.membershipType === "ANNUAL";
}

// ---------------------------------------------------------------------------
// 3. 조직 권한: 조회 vs 실무 분리
// ---------------------------------------------------------------------------

/** 조직 조회 가능 (모니터링/목록용). PLATFORM_ADMIN 전체, CLIENT_ADMIN 본인 소유만 */
export function canViewOrganization(
  user: UserLike | null | undefined,
  organization: OrgLike | null | undefined
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (isClientAdmin(user) && organization?.ownerUserId === user.id) return true;
  return false;
}

/** 조직 실무(수정/설정) 가능. CLIENT_ADMIN 본인 소유만. PLATFORM_ADMIN은 플랫폼 운영 전용으로 실무 false */
export function canManageOrganization(
  user: UserLike | null | undefined,
  organization: OrgLike | null | undefined
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return false;
  if (isClientAdmin(user) && organization?.ownerUserId === user.id) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 4. 대회 권한: 조회 vs 실무 분리
// ---------------------------------------------------------------------------

/**
 * 대회 조회 가능 (모니터링/상세 보기).
 * - PLATFORM_ADMIN: true (모니터링용).
 * - CLIENT_ADMIN: 본인 조직 대회만 true.
 * - ZONE_MANAGER: 권역 배정 연동은 5/8단계에서 처리. 여기서는 false.
 */
export function canViewTournament(
  user: UserLike | null | undefined,
  tournament: TournamentLike | null | undefined,
  organization?: OrgLike | null
): boolean {
  if (!user) return false;
  const org = organization ?? tournament?.organization;
  if (isPlatformAdmin(user)) return true;
  if (isClientAdmin(user) && org?.ownerUserId === user.id) return true;
  return false;
}

/**
 * 대회 실무(수정/참가 확정/대진 생성·강제수정 등) 가능.
 * - PLATFORM_ADMIN: true (필요 시 전체 대회 데이터 수정 가능).
 * - CLIENT_ADMIN: 본인 조직 대회만 true.
 * - ZONE_MANAGER: false (권역 API로만 결과/진출).
 * 대회 생성(POST)은 canManageOrganization 사용 → CLIENT_ADMIN만.
 */
export function canManageTournament(
  user: UserLike | null | undefined,
  tournament: TournamentLike | null | undefined,
  organization?: OrgLike | null
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  const org = organization ?? tournament?.organization;
  if (isClientAdmin(user) && org?.ownerUserId === user.id) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 5. 권역 권한: 조회 vs 실무 분리
// ---------------------------------------------------------------------------

/**
 * 권역 조회 가능.
 * - PLATFORM_ADMIN: true (전체 권역 모니터링).
 * - ZONE_MANAGER: 배정된 권역(assignedZoneIds)에 포함된 zoneId만 true.
 */
export function canViewZone(
  user: UserLike | null | undefined,
  zoneId: string,
  assignedZoneIds?: string[] | null
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (isZoneManager(user) && Array.isArray(assignedZoneIds) && assignedZoneIds.includes(zoneId))
    return true;
  return false;
}

/**
 * 권역 실무(경기 결과 입력, 진출자 확정 등) 가능.
 * - PLATFORM_ADMIN: false (실무는 ZONE_MANAGER만).
 * - ZONE_MANAGER: 배정된 권역(assignedZoneIds)에 포함된 zoneId만 true.
 */
export function canManageZone(
  user: UserLike | null | undefined,
  zoneId: string,
  assignedZoneIds?: string[] | null
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return false;
  if (isZoneManager(user) && Array.isArray(assignedZoneIds) && assignedZoneIds.includes(zoneId))
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// 6. 기존 isAdmin 호환 (조회 vs 실무 구분 시 구버전 호환용, 신규는 위 함수 사용)
// ---------------------------------------------------------------------------

/** @deprecated 조회/실무 구분이 필요하면 canView* / canManage* 사용 */
export function isAdmin(user: UserLike | null | undefined): boolean {
  return isPlatformAdmin(user) || isClientAdmin(user);
}
