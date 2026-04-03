import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDisplayName } from "@/lib/display-name";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";
import { getTournamentEntries } from "@/lib/db-tournaments";
import { TournamentDetailView } from "./TournamentDetailView";

type BasicTournament = {
  id: string;
  name: string;
  summary: string | null;
  description: string | null;
  outlinePublished: string | null;
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
  isScotch?: boolean;
  rule: {
    entryFee: number | null;
    operatingFee: number | null;
    maxEntries: number | null;
    useWaiting: boolean;
    entryConditions: string | null;
    accountNumber?: string | null;
  } | null;
};

export type TournamentDetailWithEntriesProps = {
  tournamentId: string;
  tournament: BasicTournament;
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
  const session = await getSession();
  console.time("tournament_participants_count");
  const confirmedCount = await getTournamentEntriesCountOnly(tournamentId);
  console.timeEnd("tournament_participants_count");

  console.time("tournament_participants_my_entries");
  const myEntriesRows = session
    ? await getTournamentMyEntriesOnly(tournamentId, session.id)
    : [];
  console.timeEnd("tournament_participants_my_entries");

  const shouldLoadEntriesList = currentTab === "participants" && participantsListPublic;
  console.time("tournament_participants_entries_list");
  const entries = shouldLoadEntriesList ? await getTournamentEntries(tournamentId) : [];
  console.timeEnd("tournament_participants_entries_list");
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

  return (
    <TournamentDetailView
      tournamentId={tournamentId}
      tabs={tabs}
      currentTab={currentTab}
      participantsListPublic={participantsListPublic}
      tournament={{
        name: tournament.name,
        summary: tournament.summary ?? null,
        description: tournament.description ?? null,
        outlinePublished: tournament.outlinePublished ?? null,
        outlinePdfUrl: tournament.outlinePdfUrl ?? null,
        promoContent: tournament.promoContent ?? null,
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
        rule: tournament.rule,
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
