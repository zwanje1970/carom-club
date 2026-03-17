import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCommonPageData } from "@/lib/common-page-data";
import { getTournamentBasic } from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getMockTournamentById } from "@/lib/mock-data";
import { normalizeSlugs } from "@/lib/normalize-slug";
import { TournamentDetailView } from "@/components/tournament/TournamentDetailView";
import { TournamentDetailWithEntries } from "@/components/tournament/TournamentDetailWithEntries";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { STAGE_LABELS, TOURNAMENT_STAGES } from "@/lib/tournament-stage";
import { logServerTiming } from "@/lib/perf";

function parseParticipantsListPublic(rule: { bracketConfig?: string | object | null } | null): boolean {
  if (!rule?.bracketConfig) return true;
  try {
    const raw =
      typeof rule.bracketConfig === "string" ? JSON.parse(rule.bracketConfig) : rule.bracketConfig;
    const c = raw as Record<string, unknown>;
    if (typeof c.participantsListPublic === "boolean") return c.participantsListPublic;
  } catch {
    // ignore
  }
  return true;
}

function buildTabs() {
  return [
    { id: "outline", label: "대회요강" },
    { id: "participants", label: "참가자 명단" },
    { id: "results", label: "대회결과" },
    { id: "inquiry", label: "시합문의" },
  ] as const;
}

/** 엔트리/세션 로딩 중 표시 */
function TournamentDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-xl border border-site-border bg-site-card p-6">
      <div className="h-6 w-1/3 rounded bg-site-border" />
      <div className="h-4 w-full rounded bg-site-border" />
      <div className="h-4 w-2/3 rounded bg-site-border" />
    </div>
  );
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  const dbStart = Date.now();
  let tournament = isDatabaseConfigured() ? await getTournamentBasic(id) : null;
  let useMock = false;
  if (!tournament && isDatabaseConfigured()) {
    try {
      const mock = getMockTournamentById(id);
      tournament = {
        id: mock.id,
        name: mock.name,
        description: mock.description,
        outlinePublished: mock.outlinePublished,
        venue: mock.venue,
        startAt: mock.startAt,
        endAt: mock.endAt ?? null,
        gameFormat: mock.gameFormat,
        status: mock.status,
        organizationId: mock.organization.id,
        organization: mock.organization,
        rule: mock.rule,
        matchVenues: [],
        tournamentVenues: [],
        _count: { tournamentZones: 0, finalMatches: 0 },
      } as unknown as Awaited<ReturnType<typeof getTournamentBasic>>;
      useMock = true;
    } catch {
      tournament = null;
    }
  }
  if (!tournament && !isDatabaseConfigured()) {
    const mock = getMockTournamentById(id);
    tournament = {
      id: mock.id,
      name: mock.name,
      description: mock.description,
      outlinePublished: mock.outlinePublished,
      venue: mock.venue,
      startAt: mock.startAt,
      endAt: mock.endAt ?? null,
      gameFormat: mock.gameFormat,
      status: mock.status,
      organizationId: mock.organization.id,
      organization: mock.organization,
      rule: mock.rule,
      matchVenues: [],
      tournamentVenues: [],
      _count: { tournamentZones: 0, finalMatches: 0 },
    } as unknown as Awaited<ReturnType<typeof getTournamentBasic>>;
    useMock = true;
  }
  logServerTiming("db", dbStart);

  if (!tournament) notFound();

  const copyStart = Date.now();
  const common = await getCommonPageData("tournaments");
  logServerTiming("fetch_copy", copyStart);
  const c = common.copy as Record<AdminCopyKey, string>;

  const tabs = buildTabs();
  const currentTab = (() => {
    const defaultTab = tabs[0]?.id ?? "outline";
    const t = tabs.find((tab) => tab.id === (tabParam ?? defaultTab));
    return t ? t.id : defaultTab;
  })();
  const participantsListPublic = parseParticipantsListPublic(tournament.rule);
  const accountNumber = (() => {
    try {
      const bc = tournament.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      const v = (raw as Record<string, unknown>)?.accountNumber;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  })();
  const allowMultipleSlots = (() => {
    try {
      const bc = tournament.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      return (raw as Record<string, unknown>)?.allowMultipleSlots === true;
    } catch {
      return false;
    }
  })();
  const matchVenues = Array.isArray(tournament.matchVenues)
    ? tournament.matchVenues.map((v) => ({
        displayLabel: v.displayLabel,
        venueName: v.venueName,
        address: v.address,
        phone: v.phone,
      }))
    : [];
  const tournamentVenues = Array.isArray(tournament.tournamentVenues)
    ? normalizeSlugs(
        tournament.tournamentVenues.map((tv) => ({
          id: tv.organization.id,
          name: tv.organization.name,
          slug: tv.organization.slug,
        }))
      )
    : [];
  const tournamentPayload = {
    name: tournament.name,
    summary: tournament.summary ?? null,
    description: tournament.description ?? null,
    outlinePublished: tournament.outlinePublished ?? null,
    outlinePdfUrl: tournament.outlinePdfUrl ?? null,
    promoContent: tournament.promoContent ?? null,
    posterImageUrl: tournament.posterImageUrl ?? null,
    venue: tournament.venue ?? null,
    startAt: tournament.startAt,
    endAt: tournament.endAt,
    gameFormat: tournament.gameFormat ?? null,
    status: tournament.status,
    entryFee: tournament.entryFee ?? tournament.rule?.entryFee ?? null,
    prizeInfo: tournament.prizeInfo ?? null,
    entryCondition: tournament.entryCondition ?? null,
    maxParticipants: tournament.maxParticipants ?? null,
    rule: tournament.rule
      ? {
          entryFee: tournament.rule.entryFee,
          operatingFee: tournament.rule.operatingFee,
          maxEntries: tournament.rule.maxEntries,
          useWaiting: tournament.rule.useWaiting,
          entryConditions: tournament.rule.entryConditions,
          accountNumber,
        }
      : null,
  };
  const baseProps = {
    tournamentId: id,
    tournament: { ...tournamentPayload, id: tournament.id },
    matchVenues,
    tournamentVenues,
    tabs,
    currentTab,
    participantsListPublic,
    allowMultipleSlots,
  };
  logServerTiming("page");

  if (useMock) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-site-bg">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="mb-4 text-center text-sm text-site-primary">DB 없이 미리보기 데이터로 표시 중입니다.</p>
          <TournamentDetailView
            tournamentId={id}
            tabs={tabs}
            currentTab={currentTab}
            participantsListPublic={participantsListPublic}
            tournament={{
              ...tournamentPayload,
              startAt: tournament.startAt instanceof Date ? tournament.startAt.toISOString() : String(tournament.startAt),
              endAt: tournament.endAt != null ? (tournament.endAt instanceof Date ? tournament.endAt.toISOString() : String(tournament.endAt)) : null,
            }}
            matchVenues={matchVenues}
            tournamentVenues={[]}
            confirmedCount={0}
            isLoggedIn={false}
            myEntries={[]}
            allowMultipleSlots={allowMultipleSlots}
            entryFee={tournament.entryFee ?? tournament.rule?.entryFee ?? null}
            entries={[]}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<TournamentDetailSkeleton />}>
          <TournamentDetailWithEntries {...baseProps} />
        </Suspense>

        {"tournamentStage" in tournament && tournament._count && (
          <section className="mt-8 rounded-xl border border-site-border bg-site-card p-4">
            <h2 className="text-sm font-semibold text-site-text mb-2">{getCopyValue(c, "site.tournament.bracketSectionTitle")}</h2>
            <p className="text-xs text-site-text-muted mb-3">
              진행 상태:{" "}
              {TOURNAMENT_STAGES.includes((tournament.tournamentStage ?? "SETUP") as (typeof TOURNAMENT_STAGES)[number])
                ? getCopyValue(c, `site.tournament.stage.${(tournament.tournamentStage as string) ?? "SETUP"}` as AdminCopyKey)
                : (STAGE_LABELS[(tournament.tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? tournament.tournamentStage ?? "설정")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tournaments/${id}/zones`}
                className="inline-flex items-center rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {getCopyValue(c, "site.tournament.qualifierLabel")}
              </Link>
              {(tournament._count?.finalMatches ?? 0) > 0 && (
                <Link
                  href={`/tournaments/${id}/bracket`}
                  className="inline-flex items-center rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                >
                  {getCopyValue(c, "site.tournament.finalBracketLabel")}
                </Link>
              )}
              <Link
                href={`/tournaments/${id}/results`}
                className="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                {getCopyValue(c, "site.tournament.resultsLabel")}
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
