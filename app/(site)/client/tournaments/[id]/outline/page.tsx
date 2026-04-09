import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { OutlineEditor } from "@/components/admin/OutlineEditor";
import CardBox from "@/components/admin/_components/CardBox";
import { canAccessClientDashboard } from "@/types/auth";

const tabs = [
  { href: "", label: "대회현황" },
  { href: "/edit", label: "대회수정" },
  { href: "/participants", label: "참가자" },
  { href: "/bracket", label: "대진표" },
  { href: "/card-publish", label: "카드발행" },
  { href: "/settlement", label: "정산" },
  { href: "/outline", label: "대회요강" },
  { href: "/zones", label: "경기장" },
  { href: "/results", label: "결과" },
  { href: "/co-admins", label: "공동관리자" },
  { href: "/promo", label: "홍보페이지" },
];

export default async function ClientTournamentOutlinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, clientType: true, membershipType: true },
  });
  if (!org) notFound();
  const canOutline = await canUseFeature(org, FEATURE_CODES.TOURNAMENT_PROMO_PAGE);

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      outlineDraft: true,
      outlinePublished: true,
      outlinePublishedAt: true,
    },
  });
  if (!tournament) notFound();

  const base = `/client/tournaments/${id}`;

  if (!canOutline) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-site-text">대회요강</h1>
        <FeatureGateNotice
          featureName="대회 요강"
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
        <h1 className="text-2xl font-bold text-site-text">대회요강</h1>
        <Link href={base} className="rounded-lg border border-site-border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
          ← 대회 상세
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab.href === "/outline" ? "bg-site-bg text-site-primary" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-gray-600">{tournament.name}</p>
      <CardBox>
        <OutlineEditor
          tournamentId={id}
          initialDraft={tournament.outlineDraft ?? ""}
          initialPublished={tournament.outlinePublished ?? ""}
          publishedAt={tournament.outlinePublishedAt?.toISOString() ?? null}
        />
      </CardBox>
    </div>
  );
}
