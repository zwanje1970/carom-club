import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { BracketGenerateButton } from "@/components/admin/BracketGenerateButton";
import { BracketManualEdit } from "@/components/client/BracketManualEdit";
import CardBox from "@/components/admin/_components/CardBox";

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

export default async function ClientTournamentBracketPage({
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
  const canBracket = await canUseFeature(org, FEATURE_CODES.BRACKET_SYSTEM);

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    include: {
      rule: true,
      _count: { select: { rounds: true, finalMatches: true } },
      matchVenues: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!tournament) notFound();

  const base = `/client/tournaments/${id}`;

  if (!canBracket) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-site-text">대진표 관리</h1>
        <FeatureGateNotice
          featureName="대진표 시스템"
          clientType={org.clientType}
          membershipType={org.membershipType}
          annualActive={annualActive}
        />
      </div>
    );
  }

  const rawConfig = tournament.rule?.bracketConfig;
  const config: Record<string, unknown> =
    typeof rawConfig === "string" ? (rawConfig ? JSON.parse(rawConfig) : {}) : (rawConfig ?? {});
  const gameType = (config.gameFormatMain as string) ?? tournament.rule?.bracketType ?? "carom";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">대진표 관리</h1>
        <Link href={base} className="rounded-lg border border-site-border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
          ← 대회 상세
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab.href === "/bracket" ? "bg-site-bg text-site-primary" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-gray-600">{tournament.name}</p>
      {tournament.matchVenues && tournament.matchVenues.length > 0 && (
        <div className="space-y-2 rounded-lg border border-site-border bg-site-card p-4">
          <h2 className="text-sm font-semibold text-site-text">경기장</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {tournament.matchVenues.map((v) => (
              <div key={v.id} className="rounded border border-site-border bg-site-bg/50 p-3 text-sm">
                <div className="font-medium text-site-text">[{v.displayLabel}]</div>
                {v.venueName && <div>{v.venueName}</div>}
                {v.address && <div className="text-gray-600 dark:text-slate-400">{v.address}</div>}
                {v.phone && <div className="text-gray-600 dark:text-slate-400">{v.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <CardBox>
        <BracketGenerateButton
          tournamentId={id}
          gameType={gameType}
          existingRoundsCount={tournament._count.rounds}
          tournamentStatus={tournament.status}
        />
      </CardBox>
      {gameType === "tournament" && (tournament._count.finalMatches ?? 0) > 0 && (
        <CardBox>
          <div className="space-y-2 mb-4">
            <a
              href={`/tournaments/${id}/bracket`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-site-primary hover:underline"
            >
              본선 대진표 보기 (새 탭)
            </a>
          </div>
          <BracketManualEdit tournamentId={id} />
        </CardBox>
      )}
      {tournament._count.rounds > 0 && (
        <p className="text-sm text-gray-500">
          생성된 라운드가 {tournament._count.rounds}개 있습니다. 결과 입력·진출 확정은 결과 탭에서 진행할 수 있습니다.
        </p>
      )}
    </div>
  );
}
