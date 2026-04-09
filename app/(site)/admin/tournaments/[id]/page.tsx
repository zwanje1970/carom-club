import { notFound } from "next/navigation";
import { mdiTrophy } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { formatKoreanDateTime } from "@/lib/format-date";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_ADMIN_BASIC } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { getMockTournamentById } from "@/lib/mock-data";
import { BracketGenerateButton } from "@/components/admin/BracketGenerateButton";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import Buttons from "@/components/admin/_components/Buttons";
import PillTag from "@/components/admin/_components/PillTag";
import { TournamentTvAccessCard } from "@/components/admin/TournamentTvAccessCard";

function statusColor(s: string): "success" | "info" | "contrast" | "light" {
  switch (s) {
    case "OPEN":
      return "success";
    case "CLOSED":
      return "info";
    case "FINISHED":
      return "contrast";
    case "DRAFT":
    case "HIDDEN":
    default:
      return "light";
  }
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "초안",
    OPEN: "모집중",
    CLOSED: "마감",
    FINISHED: "종료",
    HIDDEN: "숨김",
  };
  return map[s] ?? s;
}

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let tournament: Awaited<
    ReturnType<
      typeof prisma.tournament.findUnique<{
        where: { id: string };
        include: { organization: { select: typeof ORGANIZATION_SELECT_ADMIN_BASIC }; rule: true; _count: { select: { rounds: true } } };
      }>
    >
  > = null;
  try {
    tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        organization: { select: ORGANIZATION_SELECT_ADMIN_BASIC },
        rule: true,
        _count: { select: { rounds: true } },
      },
    });
  } catch {
    const mock = getMockTournamentById(id);
    tournament = {
      ...mock,
      organizationId: mock.organization.id,
      organization: mock.organization,
      _count: { rounds: 0 },
    } as unknown as typeof tournament;
  }
  if (!tournament) notFound();

  const session = await getSession();
  const canManage = session ? canManageTournament(session, tournament, tournament.organization) : false;

  const gameType =
    (tournament.rule?.bracketConfig as { gameFormatMain?: string } | null)?.gameFormatMain ??
    tournament.rule?.bracketType ??
    "carom";

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title={tournament.name}>
        <Buttons>
          <Button href="/admin/tournaments" label="← 목록" color="contrast" small />
          {canManage && (
            <>
              <Button href={`/admin/tournaments/${id}/edit`} label="설정 수정" color="info" small />
              <Button href={`/admin/tournaments/${id}/outline`} label="대회요강 편집" color="contrast" outline small />
              <Button href={`/admin/tournaments/${id}/participants`} label="참가자 관리" color="contrast" outline small />
              <Button href={`/admin/tournaments/${id}/bracket`} label="대진표" color="contrast" outline small />
              <Button href={`/admin/tournaments/${id}/maintenance`} label="유지보수" color="warning" outline small />
            </>
          )}
        </Buttons>
      </SectionTitleLineWithButton>

      <CardBox className="mb-6 max-w-xl">
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[100px_1fr]">
          <dt className="text-gray-500 dark:text-slate-400">업체</dt>
          <dd className="text-gray-900 dark:text-slate-100">{tournament.organization.name}</dd>
          <dt className="text-gray-500 dark:text-slate-400">일시</dt>
          <dd>{formatKoreanDateTime(tournament.startAt)}</dd>
          <dt className="text-gray-500 dark:text-slate-400">장소</dt>
          <dd>{tournament.venue ?? "-"}</dd>
          <dt className="text-gray-500 dark:text-slate-400">상태</dt>
          <dd>
            <PillTag color={statusColor(tournament.status)} label={statusLabel(tournament.status)} small />
          </dd>
          <dt className="text-gray-500 dark:text-slate-400">경기방식</dt>
          <dd>{tournament.gameFormat ?? "-"}</dd>
        </dl>
      </CardBox>

      {canManage && (
        <BracketGenerateButton
          tournamentId={id}
          gameType={gameType}
          existingRoundsCount={tournament._count.rounds}
          tournamentStatus={tournament.status}
        />
      )}

      {canManage && <div className="mt-4 max-w-3xl"><TournamentTvAccessCard tournamentId={id} /></div>}
    </SectionMain>
  );
}
