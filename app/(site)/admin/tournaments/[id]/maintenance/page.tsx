import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { MaintenanceActions } from "./MaintenanceActions";
import { STAGE_LABELS, TOURNAMENT_STAGES } from "@/lib/tournament-stage";

export default async function AdminTournamentMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") redirect("/admin/login");

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tournamentStage: true,
      _count: {
        select: {
          finalMatches: true,
          finalQualifiers: true,
        },
      },
      tournamentZones: {
        select: { id: true },
      },
    },
  });
  if (!tournament) notFound();

  const zoneMatchCount = await prisma.bracketMatch.count({
    where: { bracket: { tournamentId: id, kind: "ZONE" } },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold text-site-text">대회 유지보수</h1>
        <Link
          href={`/admin/tournaments/${id}`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          ← 대회 상세
        </Link>
      </div>
      <p className="text-sm text-gray-600">{tournament.name}</p>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        플랫폼 관리자 전용입니다. 권역/본선 데이터 초기화 및 진행 상태 강제 변경 시 데이터가 되돌려지지 않으니 신중히 사용하세요.
      </div>
      <dl className="grid gap-2 rounded-lg border border-site-border bg-site-card p-6 text-sm">
        <dt className="text-gray-500">현재 진행 상태</dt>
        <dd className="font-medium">{STAGE_LABELS[(tournament.tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? tournament.tournamentStage}</dd>
        <dt className="text-gray-500">권역 경기 수</dt>
        <dd>{zoneMatchCount}</dd>
        <dt className="text-gray-500">저장된 본선 진출자 수</dt>
        <dd>{tournament._count.finalQualifiers}</dd>
        <dt className="text-gray-500">본선 경기 수</dt>
        <dd>{tournament._count.finalMatches}</dd>
      </dl>
      <MaintenanceActions
        tournamentId={id}
        currentStage={tournament.tournamentStage ?? "SETUP"}
        stages={TOURNAMENT_STAGES}
        stageLabels={STAGE_LABELS}
        hasZoneMatches={zoneMatchCount > 0}
        hasQualifiers={tournament._count.finalQualifiers > 0}
        hasFinalMatches={tournament._count.finalMatches > 0}
      />
    </div>
  );
}
