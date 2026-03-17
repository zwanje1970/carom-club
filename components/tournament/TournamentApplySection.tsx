"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentApplyForm } from "./TournamentApplyForm";
import { CancelEntryButton } from "./CancelEntryButton";

export type TournamentApplySectionProps = {
  tournamentId: string;
  entryFee: number | null;
  accountNumber: string | null;
  entryConditionsHtml: string | null;
  isLoggedIn: boolean;
  myEntries: Array<{
    id: string;
    status: string;
    waitingListOrder: number | null;
    paymentMarkedByApplicantAt: string | null;
    slotNumber: number;
  }>;
  canApplyFirstSlot: boolean;
  canApplyAdditionalSlot: boolean;
  applyClosedReason: string | null;
};

export function TournamentApplySection({
  tournamentId,
  entryFee,
  accountNumber,
  entryConditionsHtml,
  isLoggedIn,
  myEntries,
  canApplyFirstSlot,
  canApplyAdditionalSlot,
  applyClosedReason,
}: TournamentApplySectionProps) {
  const router = useRouter();
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const alreadyApplied = myEntries.filter((e) => e.status !== "CANCELED").length > 0;

  return (
    <div className="rounded-xl border border-site-border bg-site-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-site-text mb-3">참가자 신청내용</h2>
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
          <Link href={`/login?next=/tournaments/${tournamentId}/apply`} className="text-site-primary hover:underline font-medium">
            로그인
          </Link>
          후 참가 신청할 수 있습니다.
        </p>
      )}
      {canApplyFirstSlot && isLoggedIn && (
        <TournamentApplyForm
          tournamentId={tournamentId}
          entryFee={entryFee}
          accountNumber={accountNumber}
          entryConditionsHtml={entryConditionsHtml}
        />
      )}
      {canApplyAdditionalSlot && isLoggedIn && (
        <TournamentApplyForm
          tournamentId={tournamentId}
          entryFee={entryFee != null ? entryFee * 2 : null}
          accountNumber={accountNumber}
          entryConditionsHtml={entryConditionsHtml}
          additionalSlot
        />
      )}
    </div>
  );
}
