import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import {
  buildDefaultTournamentCardPublishData,
  parseTournamentCardPublishState,
} from "@/lib/client-card-publish";
import { CardPublishEditorClient } from "@/app/(site)/client/operations/tournaments/[id]/card-publish/CardPublishEditorClient";

export const metadata = { title: "카드 발행" };

export default async function ClientTournamentCardPublishPage({
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
      region: true,
      status: true,
      rule: { select: { bracketConfig: true } },
    },
  });
  if (!tournament) notFound();

  const state = parseTournamentCardPublishState(
    tournament.rule?.bracketConfig ?? null,
    tournament.id,
    tournament.name
  );
  const hasSavedCardData = Boolean(state.draft || state.published);
  const initial =
    state.draft ??
    state.published ??
    buildDefaultTournamentCardPublishData(tournament.id, tournament.name);
  if (!initial.displayDateText) {
    initial.displayDateText = formatKoreanDateWithWeekday(tournament.startAt);
  }
  if (!initial.displayRegionText) {
    initial.displayRegionText = tournament.region ?? "";
  }
  if (!initial.statusText) {
    initial.statusText =
      tournament.status === "OPEN"
        ? "모집중"
        : tournament.status === "FINISHED"
          ? "종료"
          : "진행중";
  }

  const base = `/client/tournaments/${id}`;
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
    { href: "/co-admins", label: "공동관리자" },
    { href: "/promo", label: "홍보페이지" },
  ] as const;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`inline-flex min-h-[36px] items-center rounded-md px-2.5 text-[11px] font-semibold ${tab.href === "/card-publish" ? "border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <CardPublishEditorClient
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        initialCardData={initial}
        initialPublished={state.published}
        hasSavedCardData={hasSavedCardData}
      />
    </div>
  );
}
