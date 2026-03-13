import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "마감",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

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
    include: { organization: { select: { name: true } } },
  });
  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">{tournament.name}</h1>
        <Link
          href={`/client/tournaments/${id}/edit`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          기본 정보 수정
        </Link>
      </div>
      <dl className="grid gap-2 rounded-lg border border-site-border bg-site-card p-6 text-sm">
        <dt className="text-gray-500">상태</dt>
        <dd>{STATUS_LABEL[tournament.status] ?? tournament.status}</dd>
        <dt className="text-gray-500">일시</dt>
        <dd>{new Date(tournament.startAt).toLocaleString("ko-KR")}</dd>
        {tournament.venue && (
          <>
            <dt className="text-gray-500">장소</dt>
            <dd>{tournament.venue}</dd>
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
          <h2 className="text-sm font-semibold text-gray-800 mb-4">대회 홍보</h2>
          <div
            className="prose prose-sm max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: tournament.promoContent }}
          />
        </div>
      )}
      <p className="text-sm text-gray-500">
        참가자 관리·대진표는 플랫폼 관리자(admin) 메뉴에서 진행할 수 있습니다.
      </p>
      <Link href="/client/tournaments" className="text-site-primary hover:underline">
        ← 대회 목록
      </Link>
    </div>
  );
}
