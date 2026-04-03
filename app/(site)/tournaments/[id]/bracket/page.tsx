import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";
import { PublicFinalBracket } from "@/components/public/PublicFinalBracket";

export default async function PublicFinalBracketPage({
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

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL");
  if (!bracket || bracket.matches.length === 0) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
            ← 대회 상세
          </Link>
          <h1 className="text-xl font-bold text-site-text mb-2">{tournament.name}</h1>
          <p className="rounded-xl border border-site-border bg-site-card p-8 text-center text-gray-500">
            {getCopyValue(c, "site.tournament.finalBracketNotCreatedYet")}
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
        <p className="text-sm text-gray-600 mb-6">{getCopyValue(c, "site.tournament.finalBracketLabel")}</p>
        <PublicFinalBracket tournamentId={tournamentId} tournamentName={tournament.name} />
      </div>
    </main>
  );
}
