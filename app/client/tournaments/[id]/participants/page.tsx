import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { getDisplayName } from "@/lib/display-name";
import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import { ZoneAssignmentSection } from "@/components/client/ZoneAssignmentSection";
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

export default async function ClientTournamentParticipantsPage({
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
  const canManageParticipants = await canUseFeature(org, FEATURE_CODES.PARTICIPANT_MANAGEMENT);

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    include: {
      entries: {
        include: {
          user: { include: { memberProfile: true } },
          attendances: true,
        },
        orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!tournament) notFound();

  const entriesForTable = tournament.entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: getDisplayName(e.user),
    userPhone: e.user.phone ?? null,
    handicap: e.user.memberProfile?.handicap ?? null,
    avg: e.user.memberProfile?.avg ?? null,
    avgProofUrl: e.user.memberProfile?.avgProofUrl ?? null,
    depositorName: e.depositorName,
    clubOrAffiliation: e.clubOrAffiliation ?? null,
    status: e.status,
    waitingListOrder: e.waitingListOrder,
    slotNumber: e.slotNumber ?? 1,
    paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
    paidAt: e.paidAt?.toISOString() ?? null,
    reviewedAt: e.reviewedAt?.toISOString() ?? null,
    rejectionReason: e.rejectionReason ?? null,
    createdAt: e.createdAt.toISOString(),
    attended: e.attendances[0]?.attended ?? null,
  }));

  const base = `/client/tournaments/${id}`;

  if (!canManageParticipants) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-site-text">참가자 관리</h1>
        <FeatureGateNotice
          featureName="참가자 관리"
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
        <h1 className="text-2xl font-bold text-site-text">참가자 관리</h1>
        <Link href={base} className="rounded-lg border border-site-border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
          ← 대회 상세
        </Link>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${tab.href === "/participants" ? "bg-site-bg text-site-primary" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-site-text-muted">{tournament.name}</p>

      <div className="rounded-lg border border-site-border bg-site-bg/50 px-4 py-3 text-sm text-site-text">
        <strong>대회 운영 콘솔</strong>에서 필터·정렬·일괄 입금확인·대기 승격:{" "}
        <Link
          href={`/client/operations/tournaments/${id}/participants`}
          className="font-medium text-site-primary underline"
        >
          참가자 관리 (콘솔)
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-site-text-muted">참가자 강제 추가는 추후 제공 예정입니다.</span>
      </div>

      <CardBox hasTable>
        <ParticipantsTable
          tournamentId={id}
          entries={entriesForTable}
        />
      </CardBox>

      <ZoneAssignmentSection tournamentId={id} />
    </div>
  );
}
