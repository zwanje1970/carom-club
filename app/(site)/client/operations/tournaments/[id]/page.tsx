import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { CloseRecruitButton } from "./CloseRecruitButton";

export const metadata = { title: "대회현황" };

function statusLabel(status: string): "모집중" | "마감" {
  return status === "OPEN" ? "모집중" : "마감";
}

function canOpenBracket(status: string): boolean {
  return status !== "OPEN" && status !== "DRAFT";
}

function resolveBracketAction(args: {
  id: string;
  status: string;
  nationalTournament: boolean;
  tournamentStage: string | null;
}): { label: string; href: string; disabled: boolean } {
  if (!canOpenBracket(args.status)) {
    return { label: "대진표", href: "#", disabled: true };
  }
  if (!args.nationalTournament) {
    return {
      label: "대진표",
      href: `/client/operations/tournaments/${args.id}/bracket`,
      disabled: false,
    };
  }
  const stage = args.tournamentStage ?? "SETUP";
  const zoneStep = stage === "SETUP" || stage.startsWith("QUALIFIER");
  if (zoneStep) {
    return { label: "권역배정", href: `/client/tournaments/${args.id}/zones`, disabled: false };
  }
  return {
    label: "대진표",
    href: `/client/operations/tournaments/${args.id}/bracket`,
    disabled: false,
  };
}

export default async function ClientTournamentStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const { id } = await params;
  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      startAt: true,
      status: true,
      maxParticipants: true,
      nationalTournament: true,
      tournamentStage: true,
      _count: { select: { entries: true } },
    },
  });
  if (!tournament) notFound();

  const [approved, pending] = await Promise.all([
    prisma.tournamentEntry.count({ where: { tournamentId: id, status: "CONFIRMED" } }),
    prisma.tournamentEntry.count({ where: { tournamentId: id, status: "APPLIED" } }),
  ]);

  const bracketAction = resolveBracketAction(tournament);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{tournament.name}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatKoreanDateWithWeekday(tournament.startAt)}</p>
        </div>
        {tournament.status === "OPEN" ? <CloseRecruitButton tournamentId={tournament.id} /> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-[12px] dark:border-zinc-700 dark:bg-zinc-900">
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-zinc-500">신청자 수</dt>
          <dd className="text-right font-semibold">
            {tournament._count.entries}
            {tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""}
          </dd>
          <dt className="text-zinc-500">참가승인 수</dt>
          <dd className="text-right font-semibold">{approved}</dd>
          <dt className="text-zinc-500">미승인 수</dt>
          <dd className="text-right font-semibold">{pending}</dd>
          <dt className="text-zinc-500">상태</dt>
          <dd className="text-right font-semibold">{statusLabel(tournament.status)}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/client/operations/tournaments/${tournament.id}/participants`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-900 bg-zinc-900 px-2 text-[11px] font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        >
          신청자관리
        </Link>
        {bracketAction.disabled ? (
          <span className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            {bracketAction.label}
          </span>
        ) : (
          <Link
            href={bracketAction.href}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          >
            {bracketAction.label}
          </Link>
        )}
        <Link
          href={`/client/billing?tournament=${tournament.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
        >
          정산
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/client/operations" className="text-xs font-semibold text-indigo-800 underline dark:text-indigo-300">
          ← 전체대회
        </Link>
      </div>
    </div>
  );
}
