import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { getClientOrgTournamentMutationRole } from "@/lib/client-tournament-access";
import { ClientTournamentDeleteControl } from "@/components/client/console/ClientTournamentDeleteControl";
import { canAccessClientDashboard } from "@/types/auth";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { CloseRecruitButton } from "@/app/(site)/client/operations/tournaments/[id]/CloseRecruitButton";

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
      href: `/client/tournaments/${args.id}/bracket`,
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
    href: `/client/tournaments/${args.id}/bracket`,
    disabled: false,
  };
}

export default async function ClientTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const canMutate = (await getClientOrgTournamentMutationRole(session.id, orgId)) != null;

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
  const base = `/client/tournaments/${tournament.id}`;

  const tabs = [
    { href: "", label: "대회현황" },
    { href: "/edit", label: "대회수정" },
    { href: "/participants", label: "참가자" },
    { href: "/bracket", label: "대진표" },
    { href: "/card-publish", label: "카드발행" },
    { href: "/settlement", label: "정산" },
    { href: "/outline", label: "대회요강" },
    { href: "/zones", label: "경기장" },
    { href: "/results", label: "결과" },
    { href: "/promo", label: "홍보페이지" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1">
          <Link
            href="/client/tournaments/new"
            className="inline-flex min-h-[36px] items-center rounded-md border border-zinc-300 px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            대회생성
          </Link>
          {tabs.map((tab) => (
            <Link
              key={tab.href || "base"}
              href={tab.href ? `${base}${tab.href}` : base}
              className={`inline-flex min-h-[36px] items-center rounded-md px-2.5 text-[11px] font-semibold ${tab.href === "" ? "border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          href={`${base}/participants`}
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
          href={`${base}/settlement`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
        >
          정산
        </Link>
        <Link
          href={`${base}/card-publish`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
        >
          카드 발행
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/client/tournaments" className="text-xs font-semibold text-indigo-800 underline dark:text-indigo-300">
          ← 전체대회
        </Link>
        {canMutate ? (
          <ClientTournamentDeleteControl tournamentId={tournament.id} tournamentName={tournament.name} variant="detail" />
        ) : null}
      </div>
    </div>
  );
}
