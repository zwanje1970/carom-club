"use client";

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
  tournament: {
    name: string;
    description: string | null;
    outlinePublished: string | null;
    venue: string | null;
    startAt: string;
    gameFormat: string | null;
    status: string;
    rule: {
      entryFee: number | null;
      operatingFee: number | null;
      maxEntries: number | null;
      useWaiting: boolean;
      entryConditions: string | null;
    } | null;
  };
  isLoggedIn: boolean;
  myEntry: { id: string; status: string; waitingListOrder: number | null } | null;
  entries: Array<{
    id: string;
    userId: string;
    userName: string;
    handicap: string | null;
    avg: string | null;
    depositorName: string | null;
    status: string;
    waitingListOrder: number | null;
  }>;
};

export function TournamentDetailTabs({
  tabs,
  currentTab,
  tournamentId,
  infoEmptyText = "안내 내용이 없습니다.",
  tournament,
  isLoggedIn,
  myEntry,
  entries,
}: TournamentDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(tabId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tabId);
    router.push(`/tournaments/${tournamentId}?${next.toString()}`);
  }

  const confirmedCount = entries.filter((e) => e.status === "CONFIRMED").length;
  const maxEntries = tournament.rule?.maxEntries ?? 0;
  const isFull = maxEntries > 0 && confirmedCount >= maxEntries;
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const canApply =
    tournament.status === "OPEN" &&
    (useWaiting || !isFull) &&
    !myEntry;
  const alreadyApplied = !!myEntry && myEntry.status !== "CANCELED";

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

      {currentTab === "info" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">{tabs.find((t) => t.id === "info")?.label ?? "대회 안내"}</h2>
          {tournament.description ? (
            <div
              className="prose prose-sm max-w-none break-words overflow-hidden"
              dangerouslySetInnerHTML={{ __html: tournament.description }}
            />
          ) : (
            <p className="text-gray-500">{infoEmptyText}</p>
          )}
          <dl className="mt-4 text-sm space-y-1">
            <dt className="text-gray-500">일시</dt>
            <dd>{formatStartAt(tournament.startAt)}</dd>
            {tournament.venue && (
              <>
                <dt className="text-gray-500">장소</dt>
                <dd>{tournament.venue}</dd>
              </>
            )}
            {tournament.gameFormat && (
              <>
                <dt className="text-gray-500">경기방식</dt>
                <dd>{tournament.gameFormat}</dd>
              </>
            )}
          </dl>
        </div>
      )}

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
          {alreadyApplied && (
            <div className="text-blue-700 bg-blue-50 p-4 rounded mb-4 flex flex-wrap items-center justify-between gap-2">
              <span>
                내 신청 상태:{" "}
                {myEntry!.status === "CONFIRMED"
                  ? "참가 확정 (취소 불가)"
                  : myEntry!.status === "APPLIED"
                    ? myEntry!.waitingListOrder != null
                      ? `대기 ${myEntry!.waitingListOrder}번`
                      : "신청됨 (입금 후 확정)"
                    : myEntry!.status === "REJECTED"
                      ? "거절"
                      : myEntry!.status === "CANCELED"
                        ? "취소"
                        : myEntry!.status}
              </span>
              {myEntry!.status === "APPLIED" && (
                <CancelEntryButton entryId={myEntry!.id} onCancel={() => router.refresh()} />
              )}
            </div>
          )}
          {!canApply && tournament.status === "OPEN" && isFull && !useWaiting && (
            <p className="text-site-text bg-site-secondary/20 border border-site-secondary/40 p-4 rounded">
              정원이 마감되었습니다. 참가 신청을 받지 않습니다.
            </p>
          )}
          {tournament.status !== "OPEN" && !alreadyApplied && (
            <p className="text-gray-500">현재 모집 중이 아닙니다.</p>
          )}
          {canApply && !isLoggedIn && (
            <p className="text-gray-500">
              <Link href={`/login?next=/tournaments/${tournamentId}?tab=apply`} className="text-blue-600 hover:underline">
                로그인
              </Link>
              후 참가 신청할 수 있습니다.
            </p>
          )}
          {canApply && isLoggedIn && (
            <TournamentApplyForm
              tournamentId={tournamentId}
              entryFee={tournament.rule?.entryFee ?? null}
              entryConditionsHtml={tournament.rule?.entryConditions ?? null}
            />
          )}
        </div>
      )}

      {currentTab === "participants" && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-lg font-semibold p-4 border-b">참가자 명단</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">이름</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">핸디</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">AVG</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.filter((e) => e.status === "CONFIRMED" || (e.status === "APPLIED" && e.waitingListOrder != null)).map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-sm">{e.userName}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{e.handicap ?? "-"}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{e.avg ?? "-"}</td>
                  <td className="px-4 py-2 text-sm">
                    {e.status === "CONFIRMED" ? "참가확정" : `대기 ${e.waitingListOrder ?? "-"}번`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {entries.filter((e) => e.status === "CONFIRMED" || (e.status === "APPLIED" && e.waitingListOrder != null)).length === 0 && (
            <p className="p-4 text-gray-500 text-center">참가자 명단이 없습니다.</p>
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
