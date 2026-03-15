import { getSession } from "@/lib/auth";
import { getDisplayName } from "@/lib/display-name";
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
  initialShowApply?: boolean;
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
  initialShowApply = false,
}: TournamentDetailWithEntriesProps) {
  const [entries, session] = await Promise.all([
    getTournamentEntries(tournamentId),
    getSession(),
  ]);
  const myEntries = session
    ? entries.filter((e) => e.userId === session.id).map((e) => ({
        id: e.id,
        status: e.status,
        waitingListOrder: e.waitingListOrder,
        paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
        slotNumber: e.slotNumber ?? 1,
      }))
    : [];
  const confirmedCount = entries.filter((e) => e.status === "CONFIRMED").length;
  const entriesForView = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: getDisplayName(e.user),
    handicap: e.user.memberProfile?.handicap ?? null,
    avg: e.user.memberProfile?.avg ?? null,
    depositorName: e.depositorName,
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
      initialShowApply={initialShowApply}
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
