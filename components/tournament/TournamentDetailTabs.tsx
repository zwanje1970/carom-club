"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TournamentApplyForm } from "./TournamentApplyForm";
import { CancelEntryButton } from "./CancelEntryButton";

/** 서버/클라이언트 동일 출력으로 하이드레이션 오류 방지 */
function formatStartAt(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = d.getMinutes();
  return `${y}. ${m}. ${day}. ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

type Tab = { id: string; label: string };

type TournamentDetailTabsProps = {
  tabs: readonly Tab[];
  currentTab: string;
  tournamentId: string;
  /** 대회 안내 탭에서 내용 없을 때 표시 문구 */
  infoEmptyText?: string;
  /** 참가자 명단 공개 여부(관리자 옵션). false면 인원 수만 표시 */
  participantsListPublic?: boolean;
  tournament: {
    name: string;
    description: string | null;
    outlinePublished: string | null;
    venue: string | null;
    startAt: string;
    gameFormat: string | null;
    status: string;
    maxParticipants?: number | null;
    rule: {
      entryFee: number | null;
      operatingFee: number | null;
      maxEntries: number | null;
      useWaiting: boolean;
      entryConditions: string | null;
    } | null;
  };
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
  canApplyFirstSlot: boolean;
  canApplyAdditionalSlot: boolean;
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

export function TournamentDetailTabs({
  tabs,
  currentTab,
  tournamentId,
  infoEmptyText = "안내 내용이 없습니다.",
  participantsListPublic = true,
  tournament,
  isLoggedIn,
  myEntries,
  allowMultipleSlots,
  entryFee,
  canApplyFirstSlot,
  canApplyAdditionalSlot,
  entries,
}: TournamentDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  function setTab(tabId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tabId);
    router.push(`/tournaments/${tournamentId}?${next.toString()}`);
  }

  const confirmedCount = entries.filter((e) => e.status === "CONFIRMED").length;
  const maxCap = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const isFull = maxCap > 0 && confirmedCount >= maxCap;
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const canApply = canApplyFirstSlot || canApplyAdditionalSlot;
  const alreadyApplied = myEntries.some((e) => e.status !== "CANCELED");
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
    <div>
      <nav className="flex border-b border-gray-200 gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px ${
              currentTab === tab.id
                ? "border-site-primary text-site-primary bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {currentTab === "outline" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">대회요강</h2>
          {tournament.outlinePublished ? (
            <div
              className="prose prose-sm max-w-none break-words overflow-hidden"
              dangerouslySetInnerHTML={{ __html: tournament.outlinePublished }}
            />
          ) : (
            <p className="text-gray-500">등록된 요강이 없습니다.</p>
          )}
        </div>
      )}

      {currentTab === "apply" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">참가신청</h2>
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
          {!canApply && !alreadyApplied && applyClosedReason && (
            <p className="text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-4 rounded-lg">
              {applyClosedReason}
            </p>
          )}
          {canApply && !isLoggedIn && (
            <p className="text-gray-500">
              <Link href={`/login?next=/tournaments/${tournamentId}?tab=apply`} className="text-blue-600 hover:underline">
                로그인
              </Link>
              후 참가 신청할 수 있습니다.
            </p>
          )}
          {canApplyFirstSlot && isLoggedIn && (
            <TournamentApplyForm
              tournamentId={tournamentId}
              entryFee={tournament.rule?.entryFee ?? null}
              entryConditionsHtml={tournament.rule?.entryConditions ?? null}
            />
          )}
          {canApplyAdditionalSlot && isLoggedIn && (
            <TournamentApplyForm
              tournamentId={tournamentId}
              entryFee={entryFee != null ? entryFee * 2 : null}
              entryConditionsHtml={tournament.rule?.entryConditions ?? null}
              additionalSlot
            />
          )}
        </div>
      )}

      {currentTab === "participants" && (
        <div className="bg-white dark:bg-site-card rounded-lg shadow overflow-hidden border border-site-border">
          <h2 className="text-lg font-semibold p-4 border-b border-site-border">참가자 명단</h2>
          {!participantsListPublic ? (
            <p className="p-4 text-site-text-muted text-sm">참가자 명단은 비공개입니다. 참가 인원 수는 상단 참가자 현황에서 확인할 수 있습니다.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-site-border">
                  <thead className="bg-site-bg/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-site-text-muted">이름</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-site-text-muted">핸디</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-site-text-muted">AVG</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-site-text-muted">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-site-border">
                    {entries.filter((e) => e.status === "CONFIRMED" || (e.status === "APPLIED" && e.waitingListOrder != null)).map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2 text-sm text-site-text">
                          {e.slotNumber > 1 ? `${e.userName} (슬롯${e.slotNumber})` : e.userName}
                        </td>
                        <td className="px-4 py-2 text-sm text-site-text-muted">{e.handicap ?? "-"}</td>
                        <td className="px-4 py-2 text-sm text-site-text-muted">{e.avg ?? "-"}</td>
                        <td className="px-4 py-2 text-sm">
                          {e.status === "CONFIRMED" ? "참가확정" : `대기 ${e.waitingListOrder ?? "-"}번`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {entries.filter((e) => e.status === "CONFIRMED" || (e.status === "APPLIED" && e.waitingListOrder != null)).length === 0 && (
                <p className="p-4 text-site-text-muted text-center text-sm">참가자 명단이 없습니다.</p>
              )}
            </>
          )}
        </div>
      )}

      {currentTab === "inquiry" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">시합문의</h2>
          <p className="text-gray-500">대회 관련 문의는 로그인 후 문의하기를 이용해 주세요.</p>
          <a href="/admin/inquiries" className="text-site-primary hover:underline text-sm mt-2 inline-block">
            문의 관리 (관리자)
          </a>
        </div>
      )}

      {currentTab === "results" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">결과</h2>
          <p className="text-gray-500">결과가 공개되면 여기에 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}
