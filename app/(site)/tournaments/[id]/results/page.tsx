import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportBracketSnapshotByKind, fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";
import { STAGE_LABELS, TOURNAMENT_STAGES } from "@/lib/tournament-stage";

export default async function PublicTournamentResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  const [tournament, common] = await Promise.all([
    getPublicTournamentOrNull(tournamentId),
    getCommonPageData("tournaments"),
  ]);
  if (!tournament) notFound();
  const c = common.copy as Record<AdminCopyKey, string>;

  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } } },
  });
  const [zoneStats, bracket] = await Promise.all([
    Promise.all(
      zones.map(async (z) => {
        const zoneBracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, z.id);
        const matches = zoneBracket?.rounds.flatMap((round) => round.matches) ?? [];
        const reductionMatches = zoneBracket?.rounds
          .filter((round) => round.roundType === "REDUCTION")
          .reduce((sum, round) => sum + round.matches.length, 0) ?? 0;
        return {
          total: matches.length,
          completed: matches.filter((m) => m.status === "COMPLETED").length,
          reductionMatches,
        };
      })
    ),
    fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL"),
  ]);
  const leagueCount = await prisma.league.count({ where: { tournamentId } });
  const zoneTotal = zoneStats.reduce((sum, z) => sum + z.total, 0);
  const zoneCompleted = zoneStats.reduce((sum, z) => sum + z.completed, 0);
  const zoneReductionTotal = zoneStats.reduce((sum, z) => sum + z.reductionMatches, 0);
  const finalTotal = bracket?.matches.length ?? 0;
  const finalCompleted = bracket?.matches.filter((m) => m.status === "COMPLETED").length ?? 0;

  const stage = (tournament.tournamentStage ?? "SETUP") as keyof typeof STAGE_LABELS;
  const stageLabel = TOURNAMENT_STAGES.includes(stage as (typeof TOURNAMENT_STAGES)[number])
    ? getCopyValue(c, `site.tournament.stage.${stage}` as AdminCopyKey)
    : (STAGE_LABELS[stage] ?? stage);

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
          ← 대회 상세
        </Link>
        <h1 className="text-xl font-bold text-site-text mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-600 mb-6">{getCopyValue(c, "site.tournament.resultsLabel")}</p>

        <div className="mb-6 rounded-xl border border-site-border bg-site-card p-4">
          <p className="text-sm text-gray-600">
            진행 상태: <span className="font-medium text-site-text">{stageLabel}</span>
          </p>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-site-text mb-3">{getCopyValue(c, "site.tournament.qualifierLabel")}</h2>
          <div className="rounded-xl border border-site-border bg-site-card p-4 mb-4">
            <p className="text-sm text-gray-600">
              완료 <span className="font-semibold text-site-text">{zoneCompleted}</span> / 전체{" "}
              <span className="font-semibold">{zoneTotal}</span> 경기
            </p>
            <p className="mt-1 text-sm text-gray-600">
              감축경기 <span className="font-semibold text-site-text">{zoneReductionTotal}</span>개
            </p>
            {zoneTotal > 0 && (
              <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-site-primary"
                  style={{ width: `${Math.round((zoneCompleted / zoneTotal) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <ul className="space-y-2">
            {zones.map((z) => (
              <li key={z.id}>
                <Link
                  href={`/tournaments/${tournamentId}/zones/${z.id}`}
                  className="block rounded-lg border border-site-border bg-site-card p-3 text-sm hover:border-site-primary/40"
                >
                  {z.name ?? z.zone.name} 결과 보기
                </Link>
              </li>
            ))}
          </ul>
          {zones.length === 0 && <p className="text-sm text-gray-500">{getCopyValue(c, "site.tournament.zonesEmpty")}</p>}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-site-text mb-3">{getCopyValue(c, "site.tournament.finalLabel")}</h2>
          {finalTotal > 0 ? (
            <>
              <div className="rounded-xl border border-site-border bg-site-card p-4 mb-4">
                <p className="text-sm text-gray-600">
                  완료 <span className="font-semibold text-site-text">{finalCompleted}</span> / 전체{" "}
                  <span className="font-semibold">{finalTotal}</span> 경기
                </p>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.round((finalCompleted / finalTotal) * 100)}%` }}
                  />
                </div>
              </div>
              <Link
                href={`/tournaments/${tournamentId}/bracket`}
                className="inline-flex items-center rounded-lg bg-violet-100 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-200"
              >
                {getCopyValue(c, "site.tournament.finalBracketView")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">{getCopyValue(c, "site.tournament.finalBracketNotCreated")}</p>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-site-border bg-site-card p-4">
          <h2 className="text-lg font-semibold text-site-text mb-2">리그전</h2>
          <p className="text-sm text-gray-600 mb-3">리그 경기표와 순위표를 확인합니다.</p>
          <Link
            href={`/tournaments/${tournamentId}/leagues`}
            className="inline-flex items-center rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            리그전 보기{leagueCount > 0 ? ` (${leagueCount})` : ""}
          </Link>
        </section>
      </div>
    </main>
  );
}
