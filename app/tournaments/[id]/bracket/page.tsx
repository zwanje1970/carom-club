import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { PublicFinalBracket } from "@/components/public/PublicFinalBracket";

export default async function PublicFinalBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) notFound();

  const finalMatchCount = await prisma.tournamentFinalMatch.count({ where: { tournamentId } });
  if (finalMatchCount === 0) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
            ← 대회 상세
          </Link>
          <h1 className="text-xl font-bold text-site-text mb-2">{tournament.name}</h1>
          <p className="rounded-xl border border-site-border bg-site-card p-8 text-center text-gray-500">
            본선 대진이 아직 생성되지 않았습니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
          ← 대회 상세
        </Link>
        <h1 className="text-xl font-bold text-site-text mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-600 mb-6">본선 대진표</p>
        <PublicFinalBracket tournamentId={tournamentId} tournamentName={tournament.name} />
      </div>
    </main>
  );
}
