import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAssignedTournamentZones } from "@/lib/auth-zone";
import { prisma } from "@/lib/db";

export default async function ZoneTournamentZoneOverviewPage({
  params,
}: {
  params: Promise<{ tzId: string }>;
}) {
  const { tzId } = await params;
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const list = await getAssignedTournamentZones(session);
  const tzInfo = list.find((t) => t.tournamentZoneId === tzId);
  if (!tzInfo) return null;

  const [participantCount, matches] = await Promise.all([
    prisma.tournamentEntryZoneAssignment.count({ where: { tournamentZoneId: tzId } }),
    prisma.tournamentZoneMatch.findMany({
      where: { tournamentZoneId: tzId },
      select: { id: true, status: true },
    }),
  ]);

  const total = matches.length;
  const completed = matches.filter((m) => m.status === "COMPLETED").length;
  const pending = matches.filter((m) => m.status === "PENDING" || m.status === "BYE").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-site-text">{tzInfo.tournamentName} · {tzInfo.zoneName}</h2>
        {tzInfo.zoneCode && <p className="text-sm text-gray-500">권역 코드: {tzInfo.zoneCode}</p>}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-site-border bg-site-card p-4">
          <dt className="text-sm text-gray-500">참가자 수</dt>
          <dd className="mt-1 text-2xl font-semibold text-site-text">{participantCount}명</dd>
        </div>
        <div className="rounded-lg border border-site-border bg-site-card p-4">
          <dt className="text-sm text-gray-500">전체 경기</dt>
          <dd className="mt-1 text-2xl font-semibold text-site-text">{total}</dd>
        </div>
        <div className="rounded-lg border border-site-border bg-site-card p-4">
          <dt className="text-sm text-gray-500">완료</dt>
          <dd className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{completed}</dd>
        </div>
        <div className="rounded-lg border border-site-border bg-site-card p-4">
          <dt className="text-sm text-gray-500">남은 경기</dt>
          <dd className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{pending}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/zone/tournament-zones/${tzId}/participants`}
          className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          참가자 보기
        </Link>
        <Link
          href={`/zone/tournament-zones/${tzId}/bracket`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          대진표 보기
        </Link>
        <Link
          href={`/zone/tournament-zones/${tzId}/results`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          결과 입력
        </Link>
      </div>
    </div>
  );
}
