import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCommonPageData } from "@/lib/common-page-data";
import { getTournamentBasic } from "@/lib/db-tournaments";
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
  const [tournamentFromDb, common] = await Promise.all([
    isDatabaseConfigured() ? getTournamentBasic(id) : Promise.resolve(null),
    getCommonPageData("tournaments"),
  ]);
  let tournament = tournamentFromDb;
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

  type TournamentShape = {
    id: string;
    name: string;
    summary: string | null;
    description: string | null;
    outlinePublished: boolean | null;
    outlinePdfUrl: string | null;
    promoContent: string | null;
    posterImageUrl: string | null;
    venue: string | null;
    startAt: Date;
    endAt: Date | null;
    gameFormat: string | null;
    status: string;
    entryFee: number | null;
    prizeInfo: string | null;
    entryCondition: string | null;
    maxParticipants: number | null;
    tournamentStage?: string | null;
    rule?: {
      bracketConfig?: string | object | null;
      entryFee?: number | null;
      operatingFee?: number | null;
      maxEntries?: number | null;
      useWaiting?: boolean;
      entryConditions?: string | null;
    } | null;
    matchVenues?: { displayLabel: string; venueName: string; address: string | null; phone: string | null }[];
    tournamentVenues?: { organization: { id: string; name: string; slug: string | null } }[];
    _count?: { finalMatches?: number };
  };
  const t = tournament as unknown as TournamentShape;

  logServerTiming("fetch_copy", dbStart);
  const c = common.copy as Record<AdminCopyKey, string>;

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
    status: t.status,
    entryFee: t.entryFee ?? t.rule?.entryFee ?? null,
    prizeInfo: t.prizeInfo ?? null,
    entryCondition: t.entryCondition ?? null,
    maxParticipants: t.maxParticipants ?? null,
    rule: t.rule
      ? {
          entryFee: t.rule.entryFee,
          operatingFee: t.rule.operatingFee,
          maxEntries: t.rule.maxEntries,
          useWaiting: t.rule.useWaiting,
          entryConditions: t.rule.entryConditions,
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
          entryFee: tournamentPayload.rule.entryFee ?? null,
          operatingFee: tournamentPayload.rule.operatingFee ?? null,
          maxEntries: tournamentPayload.rule.maxEntries ?? null,
          useWaiting: tournamentPayload.rule.useWaiting ?? false,
          entryConditions: tournamentPayload.rule.entryConditions ?? null,
          accountNumber: accountNumber ?? null,
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
                    entryFee: tournamentPayload.rule.entryFee ?? null,
                    operatingFee: tournamentPayload.rule.operatingFee ?? null,
                    maxEntries: tournamentPayload.rule.maxEntries ?? null,
                    useWaiting: tournamentPayload.rule.useWaiting ?? false,
                    entryConditions: tournamentPayload.rule.entryConditions ?? null,
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
            entryFee={t.entryFee ?? t.rule?.entryFee ?? null}
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
          <section className="mt-8 rounded-xl border border-site-border bg-site-card p-4">
            <h2 className="text-sm font-semibold text-site-text mb-2">{getCopyValue(c, "site.tournament.bracketSectionTitle")}</h2>
            <p className="text-xs text-site-text-muted mb-3">
              진행 상태:{" "}
              {TOURNAMENT_STAGES.includes((t.tournamentStage ?? "SETUP") as (typeof TOURNAMENT_STAGES)[number])
                ? getCopyValue(c, `site.tournament.stage.${(t.tournamentStage as string) ?? "SETUP"}` as AdminCopyKey)
                : (STAGE_LABELS[(t.tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? t.tournamentStage ?? "설정")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tournaments/${id}/zones`}
                className="inline-flex items-center rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {getCopyValue(c, "site.tournament.qualifierLabel")}
              </Link>
              {(t._count?.finalMatches ?? 0) > 0 && (
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
