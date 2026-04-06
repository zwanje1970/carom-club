import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTournamentDetailPromoContent, getTournamentEntries, type TournamentDetailSummary } from "@/lib/db-tournaments";
import { getDisplayName } from "@/lib/display-name";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";
import { TournamentDetailView } from "./TournamentDetailView";

export type TournamentDetailWithEntriesProps = {
  tournamentId: string;
  tournament: Pick<
    TournamentDetailSummary,
    | "name"
    | "summary"
    | "outlinePublished"
    | "outlinePdfUrl"
    | "posterImageUrl"
    | "venue"
    | "startAt"
    | "endAt"
    | "gameFormat"
    | "status"
    | "entryFee"
    | "prizeInfo"
    | "entryCondition"
    | "maxParticipants"
    | "isScotch"
    | "rule"
  >;
  matchVenues: Array<{ displayLabel: string; venueName?: string | null; address?: string | null; phone?: string | null }>;
  tournamentVenues: Array<{ id: string; name: string; slug: string; address?: string | null; phone?: string | null }>;
  tabs: readonly { id: string; label: string }[];
  currentTab: string;
  participantsListPublic: boolean;
  allowMultipleSlots: boolean;
};

/** Suspense 내부: 엔트리 + 세션 후속 로딩 후 상세 뷰 렌더. 공개 페이지 첫 응답에서 session/entries 제외. */
export async function TournamentDetailWithEntries({
  tournamentId,
  tournament,
  matchVenues,
  tournamentVenues,
  tabs,
  currentTab,
  participantsListPublic,
  allowMultipleSlots,
}: TournamentDetailWithEntriesProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-site-border bg-site-card p-4 sm:p-6">
        <h1 className="text-xl font-bold text-site-text sm:text-2xl">{tournament.name}</h1>
        <p className="mt-2 text-sm text-site-text-muted">
          {tournament.startAt instanceof Date ? tournament.startAt.toISOString() : String(tournament.startAt)}
          {tournament.endAt != null
            ? ` ~ ${tournament.endAt instanceof Date ? tournament.endAt.toISOString() : String(tournament.endAt)}`
            : ""}
        </p>
        {tournament.venue ? <p className="mt-1 text-sm text-site-text-muted">{tournament.venue}</p> : null}
        <p className="mt-1 text-sm text-site-text-muted">{tournament.status}</p>
        {tournament.summary ? <p className="mt-4 whitespace-pre-wrap text-site-text">{tournament.summary}</p> : null}
      </section>

      <Suspense fallback={null}>
        <TournamentDetailDeferredView
          tournamentId={tournamentId}
          tournament={tournament}
          tabs={tabs}
          currentTab={currentTab}
          participantsListPublic={participantsListPublic}
          matchVenues={matchVenues}
          tournamentVenues={tournamentVenues}
          allowMultipleSlots={allowMultipleSlots}
        />
      </Suspense>
    </div>
  );
}

async function TournamentDetailDeferredView({
  tournamentId,
  tournament,
  tabs,
  currentTab,
  participantsListPublic,
  matchVenues,
  tournamentVenues,
  allowMultipleSlots,
}: {
  tournamentId: string;
  tournament: TournamentDetailWithEntriesProps["tournament"];
  tabs: TournamentDetailWithEntriesProps["tabs"];
  currentTab: string;
  participantsListPublic: boolean;
  matchVenues: TournamentDetailWithEntriesProps["matchVenues"];
  tournamentVenues: TournamentDetailWithEntriesProps["tournamentVenues"];
  allowMultipleSlots: boolean;
}) {
  const shouldLoadEntriesList = currentTab === "participants" && participantsListPublic;
  const sessionPromise = getSession();
  const confirmedCountPromise = prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const entriesPromise = shouldLoadEntriesList ? getTournamentEntries(tournamentId) : Promise.resolve([]);
  const promoContentPromise =
    currentTab === "outline" && !tournament.outlinePublished?.trim()
      ? getTournamentDetailPromoContent(tournamentId)
      : Promise.resolve(null);
  const myEntriesPromise = sessionPromise.then((session) =>
    session
      ? prisma.tournamentEntry.findMany({
          where: { tournamentId, userId: session.id },
          select: {
            id: true,
            status: true,
            waitingListOrder: true,
            paymentMarkedByApplicantAt: true,
            slotNumber: true,
          },
          orderBy: [{ createdAt: "asc" }],
        })
      : []
  );

  const [session, confirmedCount, entries, myEntriesRows, promoContent] = await Promise.all([
    sessionPromise,
    confirmedCountPromise,
    entriesPromise,
    myEntriesPromise,
    promoContentPromise,
  ]);

  const myEntries = myEntriesRows.map((e) => ({
    id: e.id,
    status: e.status,
    waitingListOrder: e.waitingListOrder,
    paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
    slotNumber: e.slotNumber ?? 1,
  }));
  const entriesForView = entries.map((e: Awaited<ReturnType<typeof getTournamentEntries>>[number]) => ({
    id: e.id,
    userId: e.userId,
    userName: getDisplayName(e.user),
    handicap: e.user.memberProfile?.handicap ?? null,
    avg: e.user.memberProfile?.avg ?? null,
    depositorName: e.depositorName,
    displayName: formatTournamentEntryDisplayName({
      displayName: e.displayName,
      playerAName: e.playerAName,
      playerBName: e.playerBName,
      user: e.user,
      slotNumber: e.slotNumber,
      isScotch: tournament.isScotch === true,
    }),
    playerAName: e.playerAName ?? null,
    playerBName: e.playerBName ?? null,
    status: e.status,
    waitingListOrder: e.waitingListOrder,
    slotNumber: e.slotNumber ?? 1,
  }));
  const resolvedPromoContent = promoContent ?? null;

  return (
    <TournamentDetailView
      tournamentId={tournamentId}
      tabs={tabs}
      currentTab={currentTab}
      participantsListPublic={participantsListPublic}
      tournament={{
        name: tournament.name,
        summary: tournament.summary ?? null,
        description: null,
        outlinePublished: tournament.outlinePublished ?? null,
        outlinePdfUrl: tournament.outlinePdfUrl ?? null,
        promoContent: resolvedPromoContent,
        posterImageUrl: tournament.posterImageUrl ?? null,
        venue: tournament.venue ?? null,
        startAt: tournament.startAt instanceof Date ? tournament.startAt.toISOString() : String(tournament.startAt),
        endAt: tournament.endAt != null ? (tournament.endAt instanceof Date ? tournament.endAt.toISOString() : String(tournament.endAt)) : null,
        gameFormat: tournament.gameFormat ?? null,
        status: tournament.status,
        entryFee: tournament.entryFee ?? null,
        prizeInfo: tournament.prizeInfo ?? null,
        entryCondition: tournament.entryCondition ?? null,
        maxParticipants: tournament.maxParticipants ?? null,
        rule: tournament.rule
          ? {
              entryFee: null,
              operatingFee: null,
              maxEntries: tournament.rule.maxEntries,
              useWaiting: tournament.rule.useWaiting,
              entryConditions: null,
              accountNumber: tournament.rule.bracketConfig
                ? (() => {
                    try {
                      const raw = typeof tournament.rule?.bracketConfig === "string"
                        ? JSON.parse(tournament.rule.bracketConfig)
                        : tournament.rule.bracketConfig;
                      const v = (raw as Record<string, unknown>)?.accountNumber;
                      return typeof v === "string" && v.trim() ? v.trim() : null;
                    } catch {
                      return null;
                    }
                  })()
                : null,
            }
          : null,
      }}
      matchVenues={matchVenues}
      tournamentVenues={tournamentVenues}
      confirmedCount={confirmedCount}
      isLoggedIn={!!session}
      myEntries={myEntries}
      allowMultipleSlots={allowMultipleSlots}
      entryFee={tournament.entryFee ?? null}
      entries={entriesForView}
    />
  );
}
