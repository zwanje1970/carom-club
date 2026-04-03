import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";
import { PublicZoneBracket } from "@/components/public/PublicZoneBracket";

export default async function PublicZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string; tzId: string }>;
}) {
  const { id: tournamentId, tzId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) notFound();

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
    include: { zone: { select: { name: true, code: true } } },
  });
  if (!tz) notFound();

  const [bracket, participantCount] = await Promise.all([
    fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, tzId),
    prisma.tournamentEntry.count({
      where: { tournamentId, zoneId: tzId, status: "CONFIRMED" },
    }),
  ]);
  const matches = bracket?.rounds.flatMap((round) => round.matches) ?? [];
  const matchTotal = matches.length;
  const matchCompleted = matches.filter((m) => m.status === "COMPLETED").length;
  const reductionCount = bracket?.rounds
    .filter((round) => round.roundType === "REDUCTION")
    .reduce((sum, round) => sum + round.matches.length, 0) ?? 0;

  const zoneName = tz.name ?? tz.zone.name;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Link href={`/tournaments/${tournamentId}/zones`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
          ← 권역 목록
        </Link>
        <h1 className="text-xl font-bold text-site-text mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-600 mb-4">{zoneName}</p>

        <div className="mb-6 rounded-xl border border-site-border bg-site-card p-4">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <dt className="text-gray-500">참가자</dt>
            <dd className="font-medium">{participantCount}명</dd>
            <dt className="text-gray-500">경기</dt>
            <dd className="font-medium">{matchCompleted} / {matchTotal}</dd>
            <dt className="text-gray-500">감축경기</dt>
            <dd className="font-medium">{reductionCount}개</dd>
          </dl>
          {matchTotal > 0 && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-site-primary"
                style={{ width: `${matchTotal ? Math.round((matchCompleted / matchTotal) * 100) : 0}%` }}
              />
            </div>
          )}
        </div>

        <PublicZoneBracket tournamentId={tournamentId} tzId={tzId} zoneName={zoneName} />
      </div>
    </main>
  );
}
