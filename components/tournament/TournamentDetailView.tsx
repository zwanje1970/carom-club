"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentPromoBlock } from "./TournamentPromoBlock";
import { TournamentDetailTabs } from "./TournamentDetailTabs";
import { TournamentApplyForm } from "./TournamentApplyForm";
import { CancelEntryButton } from "./CancelEntryButton";

export type TournamentDetailViewProps = {
  tournamentId: string;
  tabs: readonly { id: string; label: string }[];
  currentTab: string;
  participantsListPublic: boolean;
  initialShowApply?: boolean;
  tournament: {
    name: string;
    summary: string | null;
    description: string | null;
    outlinePublished: string | null;
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
  initialShowApply = false,
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
  const router = useRouter();
  const [showApplySection, setShowApplySection] = useState(initialShowApply);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const applySectionRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (showApplySection && applySectionRef.current) {
      applySectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showApplySection]);

  function goToApply() {
    setShowApplySection(true);
  }

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
        onGoToApply={goToApply}
      />

      {showApplySection && (
        <div ref={applySectionRef} className="rounded-xl border border-site-border bg-site-card p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-site-text mb-3">참가신청</h2>
          {myEntries.length > 0 && (
            <div className="space-y-3 mb-4">
              <h3 className="text-sm font-semibold text-site-text">내 참가 슬롯</h3>
              {myEntries
                .filter((e) => e.status !== "CANCELED")
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-200 p-4 rounded-lg flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      <strong>슬롯{entry.slotNumber}</strong>
                      {" · "}
                      {entry.status === "CONFIRMED"
                        ? "참가 확정"
                        : entry.status === "APPLIED"
                          ? entry.waitingListOrder != null
                            ? `대기 ${entry.waitingListOrder}번`
                            : entry.paymentMarkedByApplicantAt != null
                              ? "입금확인 대기 중"
                              : "신청됨 (입금 후 입금 완료 체크)"
                          : entry.status === "REJECTED"
                            ? "거절"
                            : entry.status}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {entry.status === "APPLIED" && !entry.paymentMarkedByApplicantAt && (
                        <button
                          type="button"
                          disabled={markingPaid !== null}
                          onClick={async () => {
                            setMarkingPaid(entry.id);
                            try {
                              const res = await fetch(`/api/tournaments/entry/${entry.id}/mark-paid`, { method: "PATCH" });
                              if (!res.ok) {
                                const d = await res.json().catch(() => ({}));
                                alert(d.error || "처리 실패");
                                return;
                              }
                              router.refresh();
                            } finally {
                              setMarkingPaid(null);
                            }
                          }}
                          className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {markingPaid === entry.id ? "처리 중..." : "입금 완료했습니다"}
                        </button>
                      )}
                      {(entry.status === "APPLIED" || entry.status === "CONFIRMED") && (
                        <CancelEntryButton entryId={entry.id} onCancel={() => router.refresh()} />
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
          {!canApplyFirstSlot && !canApplyAdditionalSlot && !alreadyApplied && applyClosedReason && (
            <p className="text-site-text-muted bg-site-bg/50 rounded-lg px-4 py-3">{applyClosedReason}</p>
          )}
          {(canApplyFirstSlot || canApplyAdditionalSlot) && !isLoggedIn && (
            <p className="text-site-text-muted">
              <Link href={`/login?next=/tournaments/${tournamentId}`} className="text-site-primary hover:underline font-medium">
                로그인
              </Link>
              후 참가 신청할 수 있습니다.
            </p>
          )}
          {canApplyFirstSlot && isLoggedIn && (
            <TournamentApplyForm
              tournamentId={tournamentId}
              entryFee={tournament.rule?.entryFee ?? null}
              accountNumber={tournament.rule?.accountNumber ?? null}
              entryConditionsHtml={tournament.rule?.entryConditions ?? null}
            />
          )}
          {canApplyAdditionalSlot && isLoggedIn && (
            <TournamentApplyForm
              tournamentId={tournamentId}
              entryFee={entryFee != null ? entryFee * 2 : null}
              accountNumber={tournament.rule?.accountNumber ?? null}
              entryConditionsHtml={tournament.rule?.entryConditions ?? null}
              additionalSlot
            />
          )}
        </div>
      )}

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
