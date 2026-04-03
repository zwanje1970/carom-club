import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCommonPageData } from "@/lib/common-page-data";
import { getTournamentSummary, type TournamentDetailSummary } from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getMockTournamentById } from "@/lib/mock-data";
import { normalizeSlugs } from "@/lib/normalize-slug";
import { TournamentDetailView, type TournamentDetailViewProps } from "@/components/tournament/TournamentDetailView";
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

type TournamentPageTournament = Omit<TournamentDetailSummary, "rule"> & {
  description: string | null;
  promoContent?: string | null;
  rule: {
    maxEntries: number | null;
    useWaiting: boolean;
    bracketConfig: string | object | null;
  } | null;
};

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  console.time("tournament_page_total");
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  console.time("tournament_main");
  const dbStart = Date.now();
  const tournamentFromDb = await (isDatabaseConfigured() ? getTournamentSummary(id) : Promise.resolve(null));
  console.timeEnd("tournament_main");
  let tournament: TournamentPageTournament | null = tournamentFromDb as TournamentPageTournament | null;
  let useMock = false;
  if (!tournament && isDatabaseConfigured()) {
    try {
      const mock = getMockTournamentById(id);
      tournament = {
        id: mock.id,
        name: mock.name,
        description: mock.description,
        summary: mock.description,
        outlinePublished: mock.outlinePublished,
        outlinePdfUrl: null,
        posterImageUrl: null,
        venue: mock.venue,
        startAt: mock.startAt,
        endAt: mock.endAt ?? null,
        gameFormat: mock.gameFormat,
        isScotch: mock.isScotch ?? false,
        status: mock.status,
        entryFee: mock.rule.entryFee ?? null,
        prizeInfo: null,
        entryCondition: mock.rule.entryConditions ?? null,
        maxParticipants: mock.rule.maxEntries ?? null,
        tournamentStage: null,
        rule: mock.rule
          ? {
              maxEntries: mock.rule.maxEntries ?? null,
              useWaiting: mock.rule.useWaiting ?? false,
              bracketConfig: null,
            }
          : null,
        matchVenues: [],
        tournamentVenues: [],
        _count: { finalMatches: 0 },
      };
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
      summary: mock.description,
      outlinePublished: mock.outlinePublished,
      outlinePdfUrl: null,
      posterImageUrl: null,
      venue: mock.venue,
      startAt: mock.startAt,
      endAt: mock.endAt ?? null,
      gameFormat: mock.gameFormat,
      isScotch: mock.isScotch ?? false,
      status: mock.status,
      entryFee: mock.rule.entryFee ?? null,
      prizeInfo: null,
      entryCondition: mock.rule.entryConditions ?? null,
      maxParticipants: mock.rule.maxEntries ?? null,
      tournamentStage: null,
      rule: mock.rule
        ? {
            maxEntries: mock.rule.maxEntries ?? null,
            useWaiting: mock.rule.useWaiting ?? false,
            bracketConfig: null,
          }
        : null,
      matchVenues: [],
      tournamentVenues: [],
      _count: { finalMatches: 0 },
    };
    useMock = true;
  }
  logServerTiming("db", dbStart);

  if (!tournament) notFound();

  type TournamentShape = {
    id: string;
    name: string;
    summary: string | null;
    description?: string | null;
    outlinePublished: string | null;
    outlinePdfUrl: string | null;
    promoContent?: string | null;
    posterImageUrl: string | null;
    venue: string | null;
    startAt: Date;
    endAt: Date | null;
    gameFormat: string | null;
    isScotch?: boolean;
    status: string;
    entryFee: number | null;
    prizeInfo: string | null;
    entryCondition: string | null;
    maxParticipants: number | null;
    tournamentStage?: string | null;
    rule?: {
      bracketConfig?: string | object | null;
      maxEntries?: number | null;
      useWaiting?: boolean;
    } | null;
    matchVenues?: { displayLabel: string; venueName: string; address: string | null; phone: string | null }[];
    tournamentVenues?: { organization: { id: string; name: string; slug: string | null } }[];
    _count?: { finalMatches?: number };
  };
  const t = tournament as unknown as TournamentShape;

  const tabs = buildTabs();
  const currentTab = (() => {
    const defaultTab = tabs[0]?.id ?? "outline";
    const tab = tabs.find((tb) => tb.id === (tabParam ?? defaultTab));
    return tab ? tab.id : defaultTab;
  })();
  const participantsListPublic = parseParticipantsListPublic(t.rule ?? null);
  const accountNumber = (() => {
    try {
      const bc = t.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      const v = (raw as Record<string, unknown>)?.accountNumber;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  })();
  const allowMultipleSlots = (() => {
    try {
      const bc = t.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      return (raw as Record<string, unknown>)?.allowMultipleSlots === true;
    } catch {
      return false;
    }
  })();
  const matchVenues = Array.isArray(t.matchVenues)
    ? t.matchVenues.map((v) => ({
        displayLabel: v.displayLabel,
        venueName: v.venueName,
        address: v.address,
        phone: v.phone,
      }))
    : [];
  const tournamentVenues = Array.isArray(t.tournamentVenues)
    ? normalizeSlugs(
        t.tournamentVenues.map((tv) => ({
          id: tv.organization.id,
          name: tv.organization.name,
          slug: tv.organization.slug,
        }))
      )
    : [];
  const tournamentPayload = {
    name: t.name,
    summary: t.summary ?? null,
    description: t.description ?? null,
    outlinePublished: t.outlinePublished ?? null,
    outlinePdfUrl: t.outlinePdfUrl ?? null,
    promoContent: t.promoContent ?? null,
    posterImageUrl: t.posterImageUrl ?? null,
    venue: t.venue ?? null,
    startAt: t.startAt,
    endAt: t.endAt,
    gameFormat: t.gameFormat ?? null,
    isScotch: t.isScotch === true,
    status: t.status,
    entryFee: t.entryFee ?? null,
    prizeInfo: t.prizeInfo ?? null,
    entryCondition: t.entryCondition ?? null,
    maxParticipants: t.maxParticipants ?? null,
    rule: t.rule
      ? {
          maxEntries: t.rule.maxEntries,
          useWaiting: t.rule.useWaiting,
          accountNumber,
        }
      : null,
  };
  const baseTournament = {
    ...tournamentPayload,
    id: t.id,
    outlinePublished: tournamentPayload.outlinePublished != null ? String(tournamentPayload.outlinePublished) : null,
    rule: tournamentPayload.rule
      ? {
          bracketConfig:
            typeof t.rule?.bracketConfig === "string"
              ? t.rule.bracketConfig
              : t.rule?.bracketConfig
                ? JSON.stringify(t.rule.bracketConfig)
                : null,
          maxEntries: tournamentPayload.rule.maxEntries ?? null,
          useWaiting: tournamentPayload.rule.useWaiting ?? false,
        }
      : null,
  };
  const baseProps = {
    tournamentId: id,
    tournament: baseTournament,
    matchVenues,
    tournamentVenues,
    tabs,
    currentTab,
    participantsListPublic,
    allowMultipleSlots,
  };
  console.timeEnd("tournament_page_total");
  logServerTiming("page");

  if (useMock) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-site-bg">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <TournamentDetailView
            tournamentId={id}
            tabs={tabs}
            currentTab={currentTab}
            participantsListPublic={participantsListPublic}
            tournament={{
              ...tournamentPayload,
              outlinePublished: tournamentPayload.outlinePublished != null ? String(tournamentPayload.outlinePublished) : null,
              startAt: t.startAt instanceof Date ? t.startAt.toISOString() : String(t.startAt),
              endAt: t.endAt != null ? (t.endAt instanceof Date ? t.endAt.toISOString() : String(t.endAt)) : null,
              rule: tournamentPayload.rule
                ? {
                    maxEntries: tournamentPayload.rule.maxEntries ?? null,
                    useWaiting: tournamentPayload.rule.useWaiting ?? false,
                    entryFee: null,
                    operatingFee: null,
                    entryConditions: null,
                    accountNumber: accountNumber ?? null,
                  }
                : null,
            } as TournamentDetailViewProps["tournament"]}
            matchVenues={matchVenues}
            tournamentVenues={[]}
            confirmedCount={0}
            isLoggedIn={false}
            myEntries={[]}
            allowMultipleSlots={allowMultipleSlots}
            entryFee={t.entryFee ?? null}
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

        {"tournamentStage" in t && t._count && (
          <Suspense fallback={null}>
            <TournamentStageSection
              tournamentId={id}
              tournamentStage={t.tournamentStage ?? null}
              finalMatchesCount={t._count?.finalMatches ?? 0}
            />
          </Suspense>
        )}
      </div>
    </main>
  );
}

async function TournamentStageSection({
  tournamentId,
  tournamentStage,
  finalMatchesCount,
}: {
  tournamentId: string;
  tournamentStage: string | null;
  finalMatchesCount: number;
}) {
  console.time("tournament_related");
  const common = await getCommonPageData("tournaments");
  const c = common.copy as Record<AdminCopyKey, string>;
  const stageLabel = TOURNAMENT_STAGES.includes((tournamentStage ?? "SETUP") as (typeof TOURNAMENT_STAGES)[number])
    ? getCopyValue(c, `site.tournament.stage.${(tournamentStage as string) ?? "SETUP"}` as AdminCopyKey)
    : (STAGE_LABELS[(tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? tournamentStage ?? "설정");
  console.timeEnd("tournament_related");

  return (
    <section className="mt-8 rounded-xl border border-site-border bg-site-card p-4">
      <h2 className="text-sm font-semibold text-site-text mb-2">{getCopyValue(c, "site.tournament.bracketSectionTitle")}</h2>
      <p className="text-xs text-site-text-muted mb-3">
        진행 상태: {stageLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/tournaments/${tournamentId}/zones`}
          className="inline-flex items-center rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
        >
          {getCopyValue(c, "site.tournament.qualifierLabel")}
        </Link>
        {finalMatchesCount > 0 && (
          <Link
            href={`/tournaments/${tournamentId}/bracket`}
            className="inline-flex items-center rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
          >
            {getCopyValue(c, "site.tournament.finalBracketLabel")}
          </Link>
        )}
        <Link
          href={`/tournaments/${tournamentId}/results`}
          className="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        >
          {getCopyValue(c, "site.tournament.resultsLabel")}
        </Link>
      </div>
    </section>
  );
}
