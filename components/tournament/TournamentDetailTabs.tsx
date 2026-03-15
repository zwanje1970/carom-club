"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = { id: string; label: string };

type TournamentDetailTabsProps = {
  tabs: readonly Tab[];
  currentTab: string;
  tournamentId: string;
  /** 참가자 명단 공개 여부(관리자 옵션). false면 인원 수만 표시 */
  participantsListPublic?: boolean;
  tournament: {
    name: string;
    description: string | null;
    outlinePublished: string | null;
    outlinePdfUrl?: string | null;
    posterImageUrl?: string | null;
    promoContent?: string | null;
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
      accountNumber?: string | null;
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
  participantsListPublic = true,
  tournament,
  isLoggedIn: _isLoggedIn,
  myEntries: _myEntries,
  entryFee: _entryFee,
  canApplyFirstSlot: _canApplyFirstSlot,
  canApplyAdditionalSlot: _canApplyAdditionalSlot,
  entries,
}: TournamentDetailTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(tabId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tabId);
    router.push(`/tournaments/${tournamentId}?${next.toString()}`);
  }

  return (
    <div>
      <nav className="grid grid-cols-3 sm:flex flex-wrap border-b border-gray-200 gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`px-2 py-2.5 sm:px-4 text-sm font-medium rounded-t border-b-2 -mb-px text-center whitespace-normal leading-tight sm:whitespace-nowrap sm:text-left min-h-[2.75rem] sm:min-h-0 ${
              currentTab === tab.id
                ? "border-site-primary text-site-primary bg-white dark:bg-site-card"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-site-text-muted dark:hover:text-site-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {currentTab === "outline" && (
        <div className="bg-white dark:bg-site-card rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold mb-3">대회요강</h2>
          {/* 1. 이미지(포스터) */}
          {(tournament.posterImageUrl ?? "").trim() && (
            <div className="relative w-full aspect-[2/1] max-h-80 rounded-lg overflow-hidden bg-site-bg">
              <img
                src={(tournament.posterImageUrl ?? "").trim()}
                alt="대회 포스터"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          {/* 2. 에디터 내용 */}
          {(tournament.outlinePublished || tournament.promoContent) && (tournament.outlinePublished || tournament.promoContent || "").trim() && (
            <div
              className="prose prose-sm max-w-none break-words overflow-hidden dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: (tournament.outlinePublished || tournament.promoContent || "").trim(),
              }}
            />
          )}
          {/* 3. PDF 다운로드/미리보기 */}
          {(tournament.outlinePdfUrl ?? "").trim() && (
            <div>
              <a
                href={(tournament.outlinePdfUrl ?? "").trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-site-primary/10 px-4 py-2 text-sm font-medium text-site-primary hover:bg-site-primary/20"
              >
                PDF 다운로드 / 미리보기
              </a>
            </div>
          )}
          {!(tournament.posterImageUrl ?? "").trim() && !(tournament.outlinePublished || tournament.promoContent || "").trim() && !(tournament.outlinePdfUrl ?? "").trim() && (
            <p className="text-gray-500 dark:text-site-text-muted">등록된 요강이 없습니다.</p>
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
          <Link href="/admin/inquiries" className="text-site-primary hover:underline text-sm mt-2 inline-block">
            문의 관리 (관리자)
          </Link>
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
