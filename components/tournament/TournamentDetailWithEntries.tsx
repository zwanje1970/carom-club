import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDisplayName } from "@/lib/display-name";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";
import {
  getTournamentDetailPromoContent,
  getTournamentEntries,
  type TournamentDetailSummary,
} from "@/lib/db-tournaments";
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
  tournamentVenues: Array<{ id: string; name: string; slug: string }>;
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
  console.time("tournament_participants");
  const shouldLoadEntriesList = currentTab === "participants" && participantsListPublic;
  const sessionPromise = getSession();
  console.time("tournament_participants_count");
  const confirmedCountPromise = getTournamentEntriesCountOnly(tournamentId).finally(() =>
    console.timeEnd("tournament_participants_count")
  );
  console.time("tournament_participants_entries_list");
  const entriesPromise = (shouldLoadEntriesList ? getTournamentEntries(tournamentId) : Promise.resolve([])).finally(
    () => console.timeEnd("tournament_participants_entries_list")
  );
  const promoContentPromise = currentTab === "outline" && !tournament.outlinePublished?.trim()
    ? getTournamentDetailPromoContent(tournamentId)
    : Promise.resolve(null);
  const myEntriesPromise = sessionPromise.then((session) =>
    session ? getTournamentMyEntriesOnly(tournamentId, session.id) : []
  );

  const [session, confirmedCount, entries, myEntriesRows, promoContent] = await Promise.all([
    sessionPromise,
    confirmedCountPromise,
    entriesPromise,
    myEntriesPromise,
    promoContentPromise,
  ]);

  console.timeEnd("tournament_participants");
  const myEntries = myEntriesRows.map((e) => ({
    id: e.id,
    status: e.status,
    waitingListOrder: e.waitingListOrder,
    paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
    slotNumber: e.slotNumber ?? 1,
  }));
  const entriesForView = entries.map((e) => ({
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

async function getTournamentEntriesCountOnly(tournamentId: string): Promise<number> {
  return prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
}

async function getTournamentMyEntriesOnly(tournamentId: string, userId: string) {
  return prisma.tournamentEntry.findMany({
    where: { tournamentId, userId },
    select: {
      id: true,
      status: true,
      waitingListOrder: true,
      paymentMarkedByApplicantAt: true,
      slotNumber: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}
