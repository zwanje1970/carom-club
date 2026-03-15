/**
 * 10단계: 기능 사용 가능 여부 판별.
 * - 연회원: 플랜 기준 기능 자동 허용
 * - 일반업체: 구매/부여된 기능만 허용
 * - isActive, status, expiresAt 반영
 *
 * [확장 포인트] 유료화 시: Organization.membershipExpireDate 사용 가능.
 *   연회원 만료일 단일 필드로 판단할 경우 여기서 membershipExpireDate >= now() 추가.
 *   현재는 무료 운영 중심으로 구독/ClientMembership 위주 유지.
 */
import { prisma } from "@/lib/db";
import type { OrgLike } from "@/lib/permissions";
import { isAnnualClient } from "@/lib/permissions";

const now = () => new Date();

/** 연회원 상태가 유효한지 (membershipType=ANNUAL 이고, 활성 구독 또는 ClientMembership 유효기간 내). 확장 시 membershipExpireDate 반영 가능 */
export async function isAnnualMembershipActive(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { membershipType: true, membershipExpireDate: true },
  });
  if (org?.membershipType !== "ANNUAL") return false;
  // 확장: Organization.membershipExpireDate 가 있으면 만료일 체크 (현재 미사용, 구조만 확보)
  if (org.membershipExpireDate && org.membershipExpireDate < now()) return false;

  // 연회원 플랜 구독 중인지
  const activeSub = await prisma.organizationPlanSubscription.findFirst({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      plan: { code: "annual_membership", isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now() } }],
    },
  });
  if (activeSub) return true;

  // 기존 ClientMembership 유효기간 (레거시 호환)
  const membership = await prisma.clientMembership.findFirst({
    where: { organizationId: orgId },
    orderBy: { validUntil: "desc" },
  });
  return membership ? membership.validUntil >= now() : false;
}

/** 조직이 해당 요금제를 활성 구독 중인지 */
export async function hasActivePlan(orgId: string, planCode: string): Promise<boolean> {
  const sub = await prisma.organizationPlanSubscription.findFirst({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      plan: { code: planCode, isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now() } }],
    },
  });
  return !!sub;
}

/** 조직이 해당 기능에 대한 접근권이 있는지 (직접 부여 또는 플랜 포함, 유효기간 내) */
export async function hasFeatureAccess(orgId: string, featureCode: string): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { code: featureCode, isActive: true },
    select: { id: true },
  });
  if (!feature) return false;

  const access = await prisma.organizationFeatureAccess.findFirst({
    where: {
      organizationId: orgId,
      featureId: feature.id,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now() } }],
    },
  });
  return !!access;
}

/**
 * 조직이 해당 기능을 사용할 수 있는지.
 * 1) 연회원이면 연회원 플랜에 포함된 기능은 사용 가능.
 * 2) 일반업체는 구매/부여된 기능만.
 */
export async function canUseFeature(
  org: OrgLike | null | undefined,
  featureCode: string
): Promise<boolean> {
  if (!org?.id) return false;

  const orgId = org.id;

  // 연회원: 연회원 플랜에 포함된 기능이면 허용
  if (isAnnualClient(org)) {
    const annualActive = await isAnnualMembershipActive(orgId);
    if (annualActive) {
      const feat = await prisma.feature.findUnique({
        where: { code: featureCode, isActive: true },
        select: { id: true },
      });
      if (feat) {
        const plan = await prisma.pricingPlan.findFirst({
          where: { code: "annual_membership", isActive: true },
          include: { planFeatures: { where: { featureId: feat.id } } },
        });
        if (plan && plan.planFeatures.length > 0) return true;
      }
    }
  }

  // 직접 부여 또는 다른 플랜 구독으로 접근권이 있으면 허용
  return hasFeatureAccess(orgId, featureCode);
}

/** 가격 표시: 0이면 "무료", 아니면 "10,000원" 형식 */
export function formatPrice(price: number, currency: string = "KRW"): string {
  if (price === 0) return "무료";
  if (currency === "KRW") return `${price.toLocaleString()}원`;
  return `${price.toLocaleString()} ${currency}`;
}

/** 게시기간 표시: 개월 단위 */
export function formatPostingMonths(months: number): string {
  return `${months}개월`;
}

/** 대표 기능 코드 (10/11단계 게이팅 연결용) */
export const FEATURE_CODES = {
  TOURNAMENT_PROMO_PAGE: "TOURNAMENT_PROMO_PAGE",
  PARTICIPANT_MANAGEMENT: "PARTICIPANT_MANAGEMENT",
  BRACKET_SYSTEM: "BRACKET_SYSTEM",
  SETTLEMENT_SYSTEM: "SETTLEMENT_SYSTEM",
  MULTI_ZONE_OPERATION: "MULTI_ZONE_OPERATION",
} as const;
