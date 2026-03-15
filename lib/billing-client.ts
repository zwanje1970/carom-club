/**
 * 11단계: CLIENT_ADMIN용 빌링/이용 현황 데이터.
 * API /api/client/my-billing 및 /client/billing 페이지에서 공통 사용.
 */
import { prisma } from "@/lib/db";
import { isAnnualMembershipActive } from "@/lib/feature-access";

const now = new Date();

function computeAnnualStatus(
  membershipType: string | null,
  subscriptions: { plan: { code: string }; status: string; expiresAt: Date | null }[]
): "ACTIVE" | "NONE" | "EXPIRED" {
  if (membershipType !== "ANNUAL") return "NONE";
  const annualSub = subscriptions.find(
    (s) => s.plan.code === "annual_membership" && s.status === "ACTIVE" && (!s.expiresAt || s.expiresAt >= now)
  );
  if (annualSub) return "ACTIVE";
  const hadAnnual = subscriptions.some((s) => s.plan.code === "annual_membership");
  return hadAnnual ? "EXPIRED" : "NONE";
}

export type FeatureAccessItem = {
  code: string;
  name: string;
  source: "ANNUAL_PLAN" | "PLAN" | "MANUAL" | "PURCHASE";
  status: "ACTIVE" | "EXPIRED";
  expiresAt: string | null;
};

export type SubscriptionItem = {
  id: string;
  planCode: string;
  planName: string;
  planType: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  sourceType: string;
  notes: string | null;
};

export type ListingPolicyProduct = { code: string; name: string; postingMonths: number; price: number; currency: string };
export type ListingPolicy =
  | { notApplicable: true }
  | { notApplicable: false; products: ListingPolicyProduct[] };

export type BillingHistoryItem =
  | { type: "PAYMENT"; id: string; at: string; label: string; amount?: number; currency?: string; status: string; memo?: string | null }
  | { type: "SUBSCRIPTION_GRANT"; id: string; at: string; planName: string; notes?: string | null }
  | { type: "LISTING_PURCHASE"; id: string; at: string; productName: string; targetType: string; status: string; expiresAt: string | null };

export type MyBillingData = {
  organization: {
    id: string;
    name: string;
    clientType: string;
    membershipType: string;
    approvalStatus?: string;
  };
  annualMembershipActive: boolean;
  annualMembershipStatus: "ACTIVE" | "NONE" | "EXPIRED";
  subscriptions: SubscriptionItem[];
  featureAccessList: FeatureAccessItem[];
  listingPolicy: ListingPolicy;
  history: BillingHistoryItem[];
};

export async function getMyBillingData(orgId: string): Promise<MyBillingData | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, clientType: true, membershipType: true, approvalStatus: true },
  });
  if (!org) return null;

  const [
    subscriptions,
    featureAccessRows,
    paymentRecords,
    listingProducts,
    listingPurchases,
    annualActive,
  ] = await Promise.all([
    prisma.organizationPlanSubscription.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: "desc" },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            planType: true,
            planFeatures: {
              where: { feature: { isActive: true } },
              select: { feature: { select: { code: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.organizationFeatureAccess.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: "desc" },
      include: { feature: { select: { code: true, name: true, isActive: true } } },
    }),
    prisma.paymentRecord.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { plan: { select: { code: true, name: true } } },
    }),
    prisma.listingProduct.findMany({
      where: { isActive: true, appliesToGeneralOnly: true },
      select: { code: true, name: true, postingMonths: true, price: true, currency: true },
    }),
    prisma.listingPurchaseRecord.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { listingProduct: { select: { code: true, name: true } } },
    }),
    isAnnualMembershipActive(orgId),
  ]);

  const annualMembershipStatus = computeAnnualStatus(org.membershipType, subscriptions);
  const activeSubs = subscriptions.filter(
    (s) => s.status === "ACTIVE" && (!s.expiresAt || s.expiresAt >= now)
  );

  const featureMap = new Map<string, FeatureAccessItem>();
  for (const acc of featureAccessRows) {
    if (!acc.feature.isActive) continue;
    const expired = acc.expiresAt ? acc.expiresAt < now : false;
    const status = acc.status === "ACTIVE" && !expired ? "ACTIVE" : "EXPIRED";
    const source = acc.sourceType === "MEMBERSHIP" ? "ANNUAL_PLAN" : acc.sourceType === "PLAN" ? "PLAN" : acc.sourceType === "MANUAL" ? "MANUAL" : "PURCHASE";
    featureMap.set(acc.feature.code, {
      code: acc.feature.code,
      name: acc.feature.name,
      source,
      status,
      expiresAt: acc.expiresAt?.toISOString() ?? null,
    });
  }
  for (const sub of activeSubs) {
    const isAnnual = sub.plan.code === "annual_membership";
    const planFeatures = "planFeatures" in sub.plan ? (sub.plan as { planFeatures: { feature: { code: string; name: string } }[] }).planFeatures : [];
    for (const pf of planFeatures) {
      const code = pf.feature.code;
      if (featureMap.has(code)) continue;
      featureMap.set(code, {
        code,
        name: pf.feature.name,
        source: isAnnual ? "ANNUAL_PLAN" : "PLAN",
        status: "ACTIVE",
        expiresAt: sub.expiresAt?.toISOString() ?? null,
      });
    }
  }

  const listingPolicy: ListingPolicy =
    org.clientType === "REGISTERED"
      ? { notApplicable: true }
      : {
          notApplicable: false,
          products: listingProducts.map((p) => ({
            code: p.code,
            name: p.name,
            postingMonths: p.postingMonths,
            price: p.price,
            currency: p.currency,
          })),
        };

  const history: BillingHistoryItem[] = [];
  for (const r of paymentRecords) {
    history.push({
      type: "PAYMENT",
      id: r.id,
      at: r.createdAt.toISOString(),
      label: r.plan?.name ?? "결제",
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      memo: r.memo,
    });
  }
  for (const s of subscriptions.slice(0, 15)) {
    if (s.sourceType === "MANUAL" || s.notes) {
      history.push({
        type: "SUBSCRIPTION_GRANT",
        id: s.id,
        at: s.createdAt.toISOString(),
        planName: s.plan.name,
        notes: s.notes,
      });
    }
  }
  for (const lp of listingPurchases) {
    history.push({
      type: "LISTING_PURCHASE",
      id: lp.id,
      at: lp.createdAt.toISOString(),
      productName: lp.listingProduct.name,
      targetType: lp.targetType,
      status: lp.status,
      expiresAt: lp.expiresAt?.toISOString() ?? null,
    });
  }
  history.sort((a, b) => (b.at > a.at ? 1 : -1));

  return {
    organization: {
      id: org.id,
      name: org.name,
      clientType: org.clientType ?? "GENERAL",
      membershipType: org.membershipType ?? "NONE",
      approvalStatus: org.approvalStatus ?? undefined,
    },
    annualMembershipActive: annualActive,
    annualMembershipStatus,
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      planCode: s.plan.code,
      planName: s.plan.name,
      planType: s.plan.planType,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      expiresAt: s.expiresAt?.toISOString() ?? null,
      sourceType: s.sourceType,
      notes: s.notes,
    })),
    featureAccessList: Array.from(featureMap.values()),
    listingPolicy,
    history: history.slice(0, 30),
  };
}
