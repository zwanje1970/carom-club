import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

export default async function PublicTournamentZonesPage({
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

  const zoneIds = zones.map((z) => z.id);
  const [matchCounts, completedCounts, participantCounts] = await Promise.all([
    prisma.tournamentZoneMatch.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds } },
      _count: { id: true },
    }),
    prisma.tournamentZoneMatch.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds }, status: "COMPLETED" },
      _count: { id: true },
    }),
    prisma.tournamentEntryZoneAssignment.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds }, entry: { status: "CONFIRMED" } },
      _count: { id: true },
    }),
  ]);
  const totalByZone = Object.fromEntries(matchCounts.map((m) => [m.tournamentZoneId, m._count.id]));
  const completedByZone = Object.fromEntries(completedCounts.map((m) => [m.tournamentZoneId, m._count.id]));
  const participantByZone = Object.fromEntries(participantCounts.map((m) => [m.tournamentZoneId, m._count.id]));

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
          ← 대회 상세
        </Link>
        <h1 className="text-xl font-bold text-site-text mb-1">{tournament.name}</h1>
        <p className="text-sm text-gray-600 mb-6">{getCopyValue(c, "site.tournament.qualifierLabel")}</p>

        <ul className="space-y-4">
          {zones.map((z) => {
            const total = totalByZone[z.id] ?? 0;
            const completed = completedByZone[z.id] ?? 0;
            const participants = participantByZone[z.id] ?? 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isComplete = total > 0 && completed >= total;
            return (
              <li key={z.id}>
                <Link
                  href={`/tournaments/${tournamentId}/zones/${z.id}`}
                  className="block rounded-xl border border-site-border bg-site-card p-5 shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-site-text">{z.name ?? z.zone.name}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isComplete
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : total === 0
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                      }`}
                    >
                      {isComplete ? "완료" : total === 0 ? "대기" : "진행 중"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>참가 {participants}명</span>
                    <span>경기 {completed} / {total}</span>
                  </div>
                  {total > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-site-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {zones.length === 0 && (
          <p className="rounded-xl border border-site-border bg-site-card p-8 text-center text-gray-500">
            {getCopyValue(c, "site.tournament.zonesEmpty")}
          </p>
        )}
      </div>
    </main>
  );
}
