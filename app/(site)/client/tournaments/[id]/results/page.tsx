import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { FinalStageSection } from "@/components/client/FinalStageSection";
import { STAGE_LABELS } from "@/lib/tournament-stage";

const tabs = [
  { href: "", label: "기본정보" },
  { href: "/outline", label: "대회요강" },
  { href: "/participants", label: "참가자" },
  { href: "/zones", label: "경기장" },
  { href: "/bracket", label: "대진표" },
  { href: "/results", label: "결과" },
  { href: "/co-admins", label: "공동관리자" },
  { href: "/promo", label: "홍보페이지" },
];

export default async function ClientTournamentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, clientType: true, membershipType: true },
  });
  if (!org) notFound();
  const canResults = await canUseFeature(org, FEATURE_CODES.SETTLEMENT_SYSTEM);

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, name: true, tournamentStage: true },
  });
  if (!tournament) notFound();

  const tournamentZones = await prisma.tournamentZone.findMany({
    where: { tournamentId: id },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true } } },
  });
  const zones = tournamentZones.map((tz) => ({
    id: tz.id,
    name: tz.name ?? tz.zone.name,
  }));

  const base = `/client/tournaments/${id}`;

  if (!canResults) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-site-text">결과 관리</h1>
        <FeatureGateNotice
          featureName="정산/결과 시스템"
          clientType={org.clientType}
          membershipType={org.membershipType}
          annualActive={annualActive}
          hint="경기 결과 입력·진출자 확정은 정산 시스템 권한이 필요합니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">결과 관리</h1>
        <Link href={base} className="rounded-lg border border-site-border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
          ← 대회 상세
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab.href === "/results" ? "bg-site-bg text-site-primary" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-gray-600">{tournament.name}</p>
      <p className="text-sm text-gray-500">
        진행 상태: {STAGE_LABELS[(tournament.tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? tournament.tournamentStage ?? "설정"}
      </p>

      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-site-text">권역 예선 → 본선</h2>
        <p className="mb-6 text-sm text-gray-500">
          권역별 대진표·결과 입력 후 진출자를 취합하고, 본선 32강/64강을 생성해 결과를 입력할 수 있습니다.
        </p>
        <FinalStageSection
          tournamentId={id}
          basePath={base}
          zones={zones}
        />
      </div>
    </div>
  );
}
