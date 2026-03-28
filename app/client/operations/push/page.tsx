import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { canAccessClientDashboard } from "@/types/auth";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { ClientPushBroadcastPanel } from "@/components/client/console/ClientPushBroadcastPanel";

export const metadata = { title: "푸시 발송" };

export default async function ClientOperationsPushPage() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <ConsolePageHeader title="푸시 발송" description="먼저 업체를 선택·설정해 주세요." />
        <Link
          href="/client/setup"
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-xs font-medium dark:border-zinc-600"
        >
          업체 설정
        </Link>
      </div>
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, clientType: true, membershipType: true },
  });
  if (!org) redirect("/client/setup");

  const canManage = await canUseFeature(org, FEATURE_CODES.PARTICIPANT_MANAGEMENT);
  if (!canManage) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-4">
        <ConsolePageHeader
          eyebrow="대회 운영"
          title="푸시 발송"
          description="참가자 기반 발송 기능은 사용 권한이 필요합니다."
        />
        <FeatureGateNotice
          featureName="참가자 대상 푸시 발송"
          clientType={org.clientType}
          membershipType={org.membershipType}
          annualActive={annualActive}
          hint="현재 조직 소유 대회의 참가자만 통합 조회해 발송할 수 있습니다."
        />
      </div>
    );
  }

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="대회 운영"
        title="푸시 발송"
        description={`조직 「${org.name}」 소유 대회 참가자를 통합 조회해 선택 발송합니다.`}
        actions={
          <Link
            href="/client/operations"
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-3 text-xs font-medium dark:border-zinc-600"
          >
            대회 목록
          </Link>
        }
      />
      <ClientPushBroadcastPanel
        tournaments={tournaments.map((tournament) => ({
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          startAt: tournament.startAt.toISOString(),
        }))}
      />
    </div>
  );
}
