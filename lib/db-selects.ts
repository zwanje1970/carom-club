/**
 * Prisma 공용 select 상수 — runtime 컬럼 불일치·과조회 방지.
 * - public: 최소 필드만
 * - admin basic: 권한/표시용
 * - admin edit: 수정 폼용만 넓은 select
 * - entries, brackets, payments 등 무거운 relation은 공용 select에 넣지 않고 별도 조회.
 */

import type { Prisma } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

/** 공개 페이지: 대회/당구장 카드·상세에서 조직명·슬러그만 */
export const ORGANIZATION_SELECT_PUBLIC = {
  id: true,
  name: true,
  slug: true,
} satisfies Prisma.OrganizationSelect;

/** 관리자 목록·상세: 권한(ownerUserId) + 표시용 id, name, slug */
export const ORGANIZATION_SELECT_ADMIN_BASIC = {
  id: true,
  name: true,
  slug: true,
  ownerUserId: true,
} satisfies Prisma.OrganizationSelect;

/** 관리자 수정 폼: BASIC + type, address (당구장 수정 폼용) */
export const ORGANIZATION_SELECT_ADMIN_EDIT = {
  id: true,
  name: true,
  slug: true,
  ownerUserId: true,
  type: true,
  address: true,
} satisfies Prisma.OrganizationSelect;

/** API 권한 체크 전용: ownerUserId 만 */
export const ORGANIZATION_SELECT_OWNER = {
  ownerUserId: true,
} satisfies Prisma.OrganizationSelect;

/** 당구장 목록/경기장 선택: 주소 포함 */
export const ORGANIZATION_SELECT_VENUE = {
  id: true,
  name: true,
  slug: true,
  address: true,
} satisfies Prisma.OrganizationSelect;

/** 클라이언트 대시/기능 접근용 */
export const ORGANIZATION_SELECT_CLIENT_ACCESS = {
  id: true,
  name: true,
  clientType: true,
  membershipType: true,
  approvalStatus: true,
} satisfies Prisma.OrganizationSelect;

/** @deprecated ORGANIZATION_SELECT_ADMIN_EDIT 사용 */
export const ORGANIZATION_SELECT_ADMIN = ORGANIZATION_SELECT_ADMIN_EDIT;

// ---------------------------------------------------------------------------
// Tournament (스칼라만; relation은 쿼리에서 별도 include/select)
// ---------------------------------------------------------------------------

/** 목록·카드용: 목록/API에서 사용하는 최소 스칼라 */
export const TOURNAMENT_SELECT_LIST = {
  id: true,
  name: true,
  startAt: true,
  endAt: true,
  status: true,
  organizationId: true,
  venue: true,
  venueName: true,
  gameFormat: true,
  posterImageUrl: true,
  imageUrl: true,
  summary: true,
  maxParticipants: true,
} satisfies Prisma.TournamentSelect;

/** 공개 상세 첫 로드용 스칼라. entries/rounds/brackets 제외. */
export const TOURNAMENT_SELECT_BASIC = {
  id: true,
  organizationId: true,
  createdByUserId: true,
  name: true,
  title: true,
  slug: true,
  summary: true,
  description: true,
  posterImageUrl: true,
  imageUrl: true,
  venue: true,
  venueName: true,
  region: true,
  startAt: true,
  endAt: true,
  entryFee: true,
  prizeInfo: true,
  gameFormat: true,
  qualification: true,
  entryCondition: true,
  maxParticipants: true,
  status: true,
  tournamentStage: true,
  approvalType: true,
  rules: true,
  promoContent: true,
  outlineDraft: true,
  outlinePublished: true,
  outlinePublishedAt: true,
  outlinePdfUrl: true,
  isPromoted: true,
  promotionLevel: true,
  promotionEndDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TournamentSelect;

/** 공개 상세 = TOURNAMENT_SELECT_BASIC 와 동일(별칭). */
export const TOURNAMENT_SELECT_DETAIL_PUBLIC = TOURNAMENT_SELECT_BASIC;

/** 관리자 상세 첫 로드용: 최소 스칼라. entries는 별도 조회. */
export const TOURNAMENT_SELECT_ADMIN_BASIC = {
  id: true,
  name: true,
  status: true,
  organizationId: true,
  startAt: true,
  endAt: true,
  venue: true,
  gameFormat: true,
} satisfies Prisma.TournamentSelect;

/** 관리자 수정 폼용: 수정에 필요한 스칼라만. rule, tournamentVenues, _count(entries)는 쿼리에서 include. */
export const TOURNAMENT_SELECT_ADMIN_EDIT = {
  id: true,
  name: true,
  organizationId: true,
  startAt: true,
  endAt: true,
  venue: true,
  venueName: true,
  status: true,
  gameFormat: true,
} satisfies Prisma.TournamentSelect;

/** @deprecated TOURNAMENT_SELECT_LIST 사용 */
export const TOURNAMENT_SELECT_CARD = TOURNAMENT_SELECT_LIST;
