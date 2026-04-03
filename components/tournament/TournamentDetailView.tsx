"use client";

import Link from "next/link";
import { TournamentPromoBlock } from "./TournamentPromoBlock";
import { TournamentDetailTabs } from "./TournamentDetailTabs";

export type TournamentDetailViewProps = {
  tournamentId: string;
  tabs: readonly { id: string; label: string }[];
  currentTab: string;
  participantsListPublic: boolean;
  tournament: {
    name: string;
    summary: string | null;
    description: string | null;
    outlinePublished: string | null;
    outlinePdfUrl?: string | null;
    promoContent?: string | null;
    posterImageUrl: string | null;
    venue: string | null;
    startAt: string;
    endAt: string | null;
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
  matchVenues: Array<{ displayLabel: string; venueName?: string | null; address?: string | null; phone?: string | null }>;
  tournamentVenues: Array<{ id: string; name: string; slug: string }>;
  confirmedCount: number;
  isLoggedIn: boolean;
  myEntries: Array<{
    id: string;
    status: string;
    waitingListOrder: number | null;
    paymentMarkedByApplicantAt: string | null;
    slotNumber: number;
  }>;
  allowMultipleSlots: boolean;
  entryFee: number | null;
  entries: Array<{
    id: string;
    userId: string;
    userName: string;
    displayName?: string | null;
    playerAName?: string | null;
    playerBName?: string | null;
    handicap: string | null;
    avg: string | null;
    depositorName: string | null;
    status: string;
    waitingListOrder: number | null;
    slotNumber: number;
  }>;
};

export function TournamentDetailView({
  tournamentId,
  tabs,
  currentTab,
  participantsListPublic,
  tournament,
  matchVenues,
  tournamentVenues,
  confirmedCount,
  isLoggedIn,
  myEntries,
  allowMultipleSlots,
  entryFee,
  entries,
}: TournamentDetailViewProps) {
  const maxCap = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const isFull = maxCap > 0 && confirmedCount >= maxCap;
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const activeEntries = myEntries.filter((e) => e.status !== "CANCELED");
  const canApplyFirstSlot = tournament.status === "OPEN" && (useWaiting || !isFull) && activeEntries.length === 0;
  const canApplyAdditionalSlot = tournament.status === "OPEN" && (useWaiting || !isFull) && allowMultipleSlots && activeEntries.length >= 1;
  const alreadyApplied = activeEntries.length > 0;
  const applyClosedReason =
    tournament.status === "DRAFT"
      ? "아직 참가 신청을 받지 않습니다."
      : tournament.status === "CLOSED"
        ? "참가 신청이 마감되었습니다."
        : tournament.status === "FINISHED"
          ? "종료된 대회입니다."
          : isFull && !useWaiting
            ? "정원이 마감되었습니다."
            : null;

  return (
    <div className="space-y-8">
      <Link href="/tournaments" className="text-sm text-site-text-muted hover:text-site-primary inline-block">
        ← 대회 목록
      </Link>

      <TournamentPromoBlock
        tournamentId={tournamentId}
        name={tournament.name}
        posterImageUrl={tournament.posterImageUrl}
        summary={tournament.summary}
        entryFee={tournament.entryFee ?? tournament.rule?.entryFee ?? null}
        prizeInfo={tournament.prizeInfo}
        gameFormat={tournament.gameFormat}
        entryCondition={tournament.entryCondition}
        startAt={tournament.startAt}
        endAt={tournament.endAt}
        venue={tournament.venue}
        matchVenues={matchVenues.length > 0 ? matchVenues : undefined}
        tournamentVenues={tournamentVenues}
        maxParticipants={tournament.maxParticipants ?? tournament.rule?.maxEntries ?? null}
        confirmedCount={confirmedCount}
        useWaiting={useWaiting}
        status={tournament.status}
        isLoggedIn={isLoggedIn}
        canApply={canApplyFirstSlot || canApplyAdditionalSlot}
        alreadyApplied={alreadyApplied}
        applyClosedReason={applyClosedReason}
      />

      <TournamentDetailTabs
        tabs={tabs}
        currentTab={currentTab}
        tournamentId={tournamentId}
        participantsListPublic={participantsListPublic}
        tournament={{
          name: tournament.name,
          description: tournament.description,
          outlinePublished: tournament.outlinePublished,
          promoContent: tournament.promoContent,
          venue: tournament.venue,
          startAt: tournament.startAt,
          gameFormat: tournament.gameFormat,
          status: tournament.status,
          maxParticipants: tournament.maxParticipants,
          rule: tournament.rule,
        }}
        isLoggedIn={isLoggedIn}
        myEntries={myEntries}
        entryFee={entryFee}
        canApplyFirstSlot={canApplyFirstSlot}
        canApplyAdditionalSlot={canApplyAdditionalSlot}
        entries={entries}
      />
    </div>
  );
}
