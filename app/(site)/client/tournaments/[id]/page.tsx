import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formatKoreanDateTime } from "@/lib/format-date";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { STAGE_LABELS } from "@/lib/tournament-stage";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "참가 마감",
  BRACKET_GENERATED: "대진 생성됨",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

const STAGE_BADGE_CLASS: Record<string, string> = {
  SETUP: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  QUALIFIER_RUNNING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  QUALIFIER_COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  FINAL_READY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  FINAL_RUNNING: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  COMPLETED: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

function stageMessage(stage: string | null | undefined): string | null {
  if (!stage) return null;
  switch (stage) {
    case "QUALIFIER_RUNNING":
      return "권역 예선이 진행 중입니다.";
    case "QUALIFIER_COMPLETED":
      return "권역 결과가 완료되었습니다. 본선 진출자를 취합하세요.";
    case "FINAL_READY":
      return "본선 준비가 완료되었습니다. 본선 대진표를 생성하세요.";
    case "FINAL_RUNNING":
      return "본선 경기가 진행 중입니다.";
    case "COMPLETED":
      return "대회가 종료되었습니다.";
    case "SETUP":
    default:
      return null;
  }
}

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

export default async function ClientTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) notFound();

  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    include: {
      organization: { select: { name: true } }, // 클라이언트 상세 헤더: 이름만
      matchVenues: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!tournament) notFound();

  const base = `/client/tournaments/${id}`;

  const stage = tournament.tournamentStage ?? "SETUP";
  const stageLabel = STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage;
  const badgeClass = STAGE_BADGE_CLASS[stage] ?? STAGE_BADGE_CLASS.SETUP;
  const message = stageMessage(stage);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">{tournament.name}</h1>
        <Link
          href={`/client/operations/tournaments/${id}/edit`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          기본 정보 수정
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
          {stageLabel}
        </span>
        {message && (
          <span className="text-sm text-gray-600 dark:text-slate-400">{message}</span>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-site-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-site-primary"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <dl className="grid gap-2 rounded-lg border border-site-border bg-site-card p-6 text-sm">
        <dt className="text-gray-500">업체</dt>
        <dd className="font-medium text-site-text">{tournament.organization.name}</dd>
        <dt className="text-gray-500">상태</dt>
        <dd>{STATUS_LABEL[tournament.status] ?? tournament.status}</dd>
        <dt className="text-gray-500">일시</dt>
        <dd>{formatKoreanDateTime(tournament.startAt)}</dd>
        {tournament.venue && (
          <>
            <dt className="text-gray-500">장소</dt>
            <dd>{tournament.venue}</dd>
          </>
        )}
        {tournament.matchVenues && tournament.matchVenues.length > 0 && (
          <>
            <dt className="text-gray-500">경기장</dt>
            <dd className="space-y-3">
              {tournament.matchVenues.map((v) => (
                <div key={v.id} className="rounded border border-site-border bg-site-bg/50 p-3 text-sm">
                  <div className="font-medium text-site-text">[{v.displayLabel}]</div>
                  {v.venueName && <div>{v.venueName}</div>}
                  {v.address && <div className="text-gray-600 dark:text-slate-400">{v.address}</div>}
                  {v.phone && <div className="text-gray-600 dark:text-slate-400">{v.phone}</div>}
                </div>
              ))}
            </dd>
          </>
        )}
        {tournament.entryFee != null && (
          <>
            <dt className="text-gray-500">참가비</dt>
            <dd>{tournament.entryFee.toLocaleString()}원</dd>
          </>
        )}
        {tournament.maxParticipants != null && (
          <>
            <dt className="text-gray-500">참가 인원</dt>
            <dd>{tournament.maxParticipants}명</dd>
          </>
        )}
        {tournament.entryCondition && (
          <>
            <dt className="text-gray-500">참가 조건</dt>
            <dd>{tournament.entryCondition}</dd>
          </>
        )}
        {tournament.gameFormat && (
          <>
            <dt className="text-gray-500">경기 방식</dt>
            <dd>{tournament.gameFormat}</dd>
          </>
        )}
        {tournament.prizeInfo && (
          <>
            <dt className="text-gray-500">상금</dt>
            <dd className="whitespace-pre-wrap">{tournament.prizeInfo}</dd>
          </>
        )}
        {tournament.rules && (
          <>
            <dt className="text-gray-500">경기 요강</dt>
            <dd className="whitespace-pre-wrap">{tournament.rules}</dd>
          </>
        )}
      </dl>
      {tournament.promoContent && (
        <div className="rounded-lg border border-site-border bg-site-card p-6">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-4">대회 홍보</h2>
          <div
            className="prose prose-sm max-w-none break-words dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: tournament.promoContent }}
          />
        </div>
      )}
      <p className="text-sm text-gray-500">
        <Link href="/client/operations" className="text-site-primary hover:underline">
          ← 대회관리
        </Link>
      </p>
    </div>
  );
}
