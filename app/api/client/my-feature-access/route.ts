import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isAnnualMembershipActive } from "@/lib/feature-access";
import { canAccessClientDashboard } from "@/types/auth";

const now = new Date();

/** GET: 클라이언트 로그인 모드일 때만 자기 조직이 사용 가능한 기능 목록 */
export async function GET() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속 업체가 없습니다." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { clientType: true, membershipType: true },
  });
  if (!org) return NextResponse.json({ error: "조직을 찾을 수 없습니다." }, { status: 404 });

  const annualActive = await isAnnualMembershipActive(orgId);

  // 활성 구독의 플랜에 포함된 기능
  const activeSubs = await prisma.organizationPlanSubscription.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    include: { plan: { include: { planFeatures: { include: { feature: true } } } } },
  });
  const featureIdsFromPlans = new Set<string>();
  for (const sub of activeSubs) {
    for (const pf of sub.plan.planFeatures) {
      if (pf.feature.isActive) featureIdsFromPlans.add(pf.feature.id);
    }
  }

  // 직접 부여된 기능 접근
  const directAccess = await prisma.organizationFeatureAccess.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    include: { feature: true },
  });

  const nowDate = new Date();
  const byCode: Record<
    string,
    { code: string; name: string; source: "ANNUAL_PLAN" | "PLAN" | "MANUAL" | "PURCHASE"; status: "ACTIVE" | "EXPIRED"; expiresAt?: string }
  > = {};
  for (const acc of directAccess) {
    if (acc.feature.isActive) {
      const expired = acc.expiresAt ? acc.expiresAt < nowDate : false;
      const status = acc.status === "ACTIVE" && !expired ? "ACTIVE" : "EXPIRED";
      byCode[acc.feature.code] = {
        code: acc.feature.code,
        name: acc.feature.name,
        source: acc.sourceType === "MEMBERSHIP" ? "ANNUAL_PLAN" : acc.sourceType === "PLAN" ? "PLAN" : (acc.sourceType as "MANUAL" | "PURCHASE"),
        status,
        expiresAt: acc.expiresAt?.toISOString() ?? undefined,
      };
    }
  }
  for (const sub of activeSubs) {
    const isAnnual = sub.plan.code === "annual_membership";
    const expired = sub.expiresAt ? sub.expiresAt < nowDate : false;
    const subStatus = expired ? "EXPIRED" : "ACTIVE";
    for (const pf of sub.plan.planFeatures) {
      if (pf.feature.isActive && !byCode[pf.feature.code])
        byCode[pf.feature.code] = {
          code: pf.feature.code,
          name: pf.feature.name,
          source: isAnnual ? "ANNUAL_PLAN" : "PLAN",
          status: subStatus,
          expiresAt: sub.expiresAt?.toISOString() ?? undefined,
        };
    }
  }

  return NextResponse.json({
    organization: { clientType: org.clientType ?? "GENERAL", membershipType: org.membershipType ?? "NONE" },
    annualMembershipActive: annualActive,
    features: Object.values(byCode),
  });
}
