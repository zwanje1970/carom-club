import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";

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

export default async function ClientTournamentPromoPage({
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
  const canPromo = await canUseFeature(org, FEATURE_CODES.TOURNAMENT_PROMO_PAGE);

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, name: true, promoContent: true },
  });
  if (!tournament) notFound();

  const base = `/client/tournaments/${id}`;

  if (!canPromo) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-site-text">홍보페이지</h1>
        <FeatureGateNotice
          featureName="대회 홍보 페이지"
          clientType={org.clientType}
          membershipType={org.membershipType}
          annualActive={annualActive}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">홍보페이지</h1>
        <Link href={`${base}/edit`} className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          기본 정보·홍보 수정
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab.href === "/promo" ? "bg-site-bg text-site-primary" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <p className="text-sm text-gray-600 mb-4">{tournament.name}</p>
        {tournament.promoContent ? (
          <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: tournament.promoContent }} />
        ) : (
          <p className="text-gray-500">홍보 내용이 없습니다. 기본 정보 수정에서 대회 홍보 내용을 작성할 수 있습니다.</p>
        )}
      </div>
    </div>
  );
}
