import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageTournament } from "@/lib/permissions";
import { BracketGenerateButton } from "@/components/admin/BracketGenerateButton";
import { BracketManualEdit } from "@/components/client/BracketManualEdit";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminTournamentBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, ownerUserId: true } },
      rule: true,
      _count: { select: { rounds: true, finalMatches: true } },
    },
  });
  if (!tournament) notFound();
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return (
      <div className="p-6">
        <p className="text-site-text-muted">이 대회의 대진표를 관리할 권한이 없습니다.</p>
        <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" outline small className="mt-4" />
      </div>
    );
  }

  const rawConfig = tournament.rule?.bracketConfig;
  const config: Record<string, unknown> =
    typeof rawConfig === "string" ? (rawConfig ? JSON.parse(rawConfig) : {}) : (rawConfig ?? {});
  const gameType = (config.gameFormatMain as string) ?? tournament.rule?.bracketType ?? "carom";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">대진표 관리</h1>
        <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" outline small />
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400">{tournament.name}</p>

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
          <div className="mb-4 space-y-2">
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
        <p className="text-sm text-gray-500 dark:text-slate-400">
          생성된 라운드가 {tournament._count.rounds}개 있습니다. 결과 입력·진출 확정은 참가자/결과 관리에서 진행할 수 있습니다.
        </p>
      )}
    </div>
  );
}
