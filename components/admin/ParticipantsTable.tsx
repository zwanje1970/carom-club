"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PillTag from "./_components/PillTag";
import Button from "./_components/Button";

export type DisplayState =
  | "PAYMENT_PENDING"   // 입금대기
  | "PAYMENT_MARKED"    // 입금완료표시
  | "CONFIRMED"         // 참가확정
  | "WAITING"           // 대기자
  | "CANCELED";         // 취소(취소+거절)

export type SortKey =
  | "createdAt"           // 신청순
  | "depositorName"       // 입금자명순
  | "paymentMarkedAt"     // 입금시간순
  | "confirmedAt"        // 참가확정순
  | "waitingListOrder";   // 대기순번순

const FILTER_OPTIONS: { value: "" | DisplayState; label: string }[] = [
  { value: "", label: "전체" },
  { value: "PAYMENT_PENDING", label: "입금대기" },
  { value: "PAYMENT_MARKED", label: "입금완료표시" },
  { value: "CONFIRMED", label: "참가확정" },
  { value: "WAITING", label: "대기자" },
  { value: "CANCELED", label: "취소" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "createdAt", label: "신청순" },
  { value: "depositorName", label: "입금자명순" },
  { value: "paymentMarkedAt", label: "입금시간순" },
  { value: "confirmedAt", label: "참가확정순" },
  { value: "waitingListOrder", label: "대기순번순" },
];

function getDisplayState(e: Entry): DisplayState {
  if (e.status === "CANCELED" || e.status === "REJECTED") return "CANCELED";
  if (e.status === "CONFIRMED") return "CONFIRMED";
  if (e.status === "APPLIED") {
    if (e.paidAt != null) return e.waitingListOrder != null ? "WAITING" : "CONFIRMED";
    if (e.paymentMarkedByApplicantAt != null) return "PAYMENT_MARKED";
    return "PAYMENT_PENDING";
  }
  return "CANCELED";
}

function entryStatusLabel(e: Entry): string {
  const state = getDisplayState(e);
  switch (state) {
    case "PAYMENT_PENDING": return "입금대기";
    case "PAYMENT_MARKED": return "입금확인대기";
    case "CONFIRMED": return "참가확정";
    case "WAITING": return `대기 ${e.waitingListOrder ?? "-"}번`;
    case "CANCELED": return e.status === "REJECTED" ? "거절" : "취소";
    default: return e.status;
  }
}

function displayStateColor(state: DisplayState): "info" | "warning" | "success" | "danger" | "light" {
  switch (state) {
    case "CONFIRMED": return "success";
    case "PAYMENT_MARKED": return "info";
    case "PAYMENT_PENDING": return "warning";
    case "WAITING": return "info";
    case "CANCELED": return "danger";
    default: return "light";
  }
}

type Entry = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  handicap: string | null;
  avg: string | null;
  depositorName: string | null;
  clubOrAffiliation: string | null;
  status: string;
  waitingListOrder: number | null;
  slotNumber: number;
  paymentMarkedByApplicantAt: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  attended: boolean | null;
};

function entryDisplayName(e: Entry): string {
  return e.slotNumber > 1 ? `${e.userName} (슬롯${e.slotNumber})` : e.userName;
}

export function ParticipantsTable({
  tournamentId,
  entries,
}: {
  tournamentId: string;
  entries: Entry[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"" | DisplayState>("");
  const [sort, setSort] = useState<SortKey>("paymentMarkedAt");
  const [search, setSearch] = useState("");
  const [forceStatusEntryId, setForceStatusEntryId] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    let list = [...entries];
    if (filter) {
      list = list.filter((e) => getDisplayState(e) === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.userName && e.userName.toLowerCase().includes(q)) ||
          (e.depositorName && e.depositorName.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      switch (sort) {
        case "createdAt": {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return ta - tb;
        }
        case "depositorName": {
          const na = (a.depositorName ?? "").localeCompare(b.depositorName ?? "", "ko");
          return na !== 0 ? na : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        case "paymentMarkedAt": {
          const pa = a.paymentMarkedByApplicantAt ? new Date(a.paymentMarkedByApplicantAt).getTime() : 0;
          const pb = b.paymentMarkedByApplicantAt ? new Date(b.paymentMarkedByApplicantAt).getTime() : 0;
          return pa - pb || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        case "confirmedAt": {
          const ra = a.reviewedAt && a.status === "CONFIRMED" ? new Date(a.reviewedAt).getTime() : 0;
          const rb = b.reviewedAt && b.status === "CONFIRMED" ? new Date(b.reviewedAt).getTime() : 0;
          return ra - rb;
        }
        case "waitingListOrder": {
          const wa = a.waitingListOrder ?? 9999;
          const wb = b.waitingListOrder ?? 9999;
          return wa - wb;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [entries, filter, search, sort]);

  const counts = useMemo(() => {
    let paymentPending = 0;
    let paymentMarked = 0;
    let confirmed = 0;
    let waiting = 0;
    let canceled = 0;
    entries.forEach((e) => {
      const s = getDisplayState(e);
      if (s === "PAYMENT_PENDING") paymentPending++;
      else if (s === "PAYMENT_MARKED") paymentMarked++;
      else if (s === "CONFIRMED") confirmed++;
      else if (s === "WAITING") waiting++;
      else canceled++;
    });
    return { paymentPending, paymentMarked, confirmed, waiting, canceled };
  }, [entries]);

  async function confirmPayment(entryId: string) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/confirm`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function cancelEntry(entryId: string) {
    if (!confirm("이 신청을 취소 처리하시겠습니까?")) return;
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "취소 처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function setAbsent(entryId: string) {
    if (!confirm("불참 처리하시겠습니까?")) return;
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/absent`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function setAttendance(entryId: string, attended: boolean) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attended }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function rejectEntry(entryId: string, reason: string | null) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "반려 처리 실패");
        return;
      }
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function setStatusForce(entryId: string, newStatus: string) {
    setLoadingId(entryId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/participants/${entryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "상태 변경 실패");
        return;
      }
      setForceStatusEntryId(null);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-site-border bg-site-card p-8 text-center">
        <p className="text-site-text-muted">참가 신청이 없습니다.</p>
        <p className="mt-2 text-sm text-site-text-muted">참가자 강제 추가 기능은 추후 제공 예정입니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 툴바: 필터 + 정렬 + 검색 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setFilter(opt.value as "" | DisplayState)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === opt.value
                  ? "bg-site-primary text-white"
                  : "bg-site-bg text-site-text border border-site-border hover:bg-site-border/30"
              }`}
            >
              {opt.label}
              {opt.value === "PAYMENT_MARKED" && counts.paymentMarked > 0 && (
                <span className="ml-1 font-bold">({counts.paymentMarked})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-site-text-muted whitespace-nowrap">정렬:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-site-border bg-site-bg px-3 py-1.5 text-sm text-site-text"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="이름·입금자명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-site-border bg-site-bg px-3 py-1.5 text-sm w-36 sm:w-44"
          />
        </div>
      </div>

      {/* 요약 */}
      <p className="text-sm text-site-text-muted">
        총 <strong className="text-site-text">{entries.length}</strong>명
        {counts.confirmed > 0 && <> · 확정 <strong>{counts.confirmed}</strong>명</>}
        {counts.waiting > 0 && <> · 대기 <strong>{counts.waiting}</strong>명</>}
        {counts.paymentMarked > 0 && <> · 입금확인대기 <strong className="text-site-primary">{counts.paymentMarked}</strong>명</>}
      </p>

      {/* 데스크톱 테이블 */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-site-border bg-site-card">
        <table className="min-w-full divide-y divide-site-border">
          <thead className="bg-site-bg/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">입금자명</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">이름</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">연락처</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">소속</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">신청일</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">입금표시</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">상태</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted">출석</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-site-text-muted max-w-[120px]">비고</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-site-text-muted">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-site-border">
            {filteredAndSorted.map((e) => {
              const state = getDisplayState(e);
              return (
                <tr key={e.id} className="hover:bg-site-bg/30">
                  <td className="px-3 py-2.5 text-sm font-medium text-site-text">{e.depositorName ?? "-"}</td>
                  <td className="px-3 py-2.5 text-sm text-site-text">{entryDisplayName(e)}</td>
                  <td className="px-3 py-2.5 text-sm text-site-text-muted">{e.userPhone ?? "-"}</td>
                  <td className="px-3 py-2.5 text-sm text-site-text-muted">{e.clubOrAffiliation ?? "-"}</td>
                  <td className="px-3 py-2.5 text-sm text-site-text-muted">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-site-text-muted">
                    {e.paymentMarkedByApplicantAt
                      ? new Date(e.paymentMarkedByApplicantAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    <PillTag color={displayStateColor(state)} label={entryStatusLabel(e)} small />
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {e.status === "CONFIRMED" &&
                      (e.attended === null ? (
                        <span className="text-site-text-muted">미체크</span>
                      ) : (
                        <span className={e.attended ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {e.attended ? "출석" : "결석"}
                        </span>
                      ))}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-site-text-muted max-w-[120px] truncate" title={e.rejectionReason ?? undefined}>
                    {e.status === "REJECTED" && (e.rejectionReason ?? "-")}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right">
                    <EntryActions
                      entry={e}
                      state={state}
                      tournamentId={tournamentId}
                      loadingId={loadingId}
                      onConfirmPayment={confirmPayment}
                      onCancel={cancelEntry}
                      onReject={rejectEntry}
                      onAbsent={setAbsent}
                      onAttendance={setAttendance}
                      onForceStatusOpen={() => setForceStatusEntryId(e.id)}
                      onRefresh={() => router.refresh()}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="md:hidden space-y-3">
        {filteredAndSorted.map((e) => {
          const state = getDisplayState(e);
          return (
            <div
              key={e.id}
              className="rounded-xl border border-site-border bg-site-card p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-site-text">{e.depositorName ?? "-"} <span className="text-site-text-muted text-sm">({entryDisplayName(e)})</span></p>
                  <p className="text-sm text-site-text-muted">{e.userPhone ?? "-"} · {e.clubOrAffiliation ?? "-"}</p>
                </div>
                <PillTag color={displayStateColor(state)} label={entryStatusLabel(e)} small />
              </div>
              <p className="text-xs text-site-text-muted">
                신청 {e.createdAt ? new Date(e.createdAt).toLocaleString("ko-KR") : "-"}
                {e.paymentMarkedByApplicantAt && (
                  <> · 입금표시 {new Date(e.paymentMarkedByApplicantAt).toLocaleString("ko-KR")}</>
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <EntryActions
                  entry={e}
                  state={state}
                  tournamentId={tournamentId}
                  loadingId={loadingId}
                  onConfirmPayment={confirmPayment}
                  onCancel={cancelEntry}
                  onReject={rejectEntry}
                  onAbsent={setAbsent}
                  onAttendance={setAttendance}
                  onForceStatusOpen={() => setForceStatusEntryId(e.id)}
                  onRefresh={() => router.refresh()}
                  mobile
                />
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSorted.length === 0 && (
        <p className="py-6 text-center text-sm text-site-text-muted">필터/검색 조건에 맞는 참가자가 없습니다.</p>
      )}

      {/* 강제 상태변경 모달 */}
      {forceStatusEntryId && (
        <ForceStatusModal
          entryId={forceStatusEntryId}
          onClose={() => setForceStatusEntryId(null)}
          onSet={(newStatus) => setStatusForce(forceStatusEntryId, newStatus)}
          loading={loadingId === forceStatusEntryId}
        />
      )}
    </div>
  );
}

function EntryActions({
  entry: e,
  state,
  tournamentId,
  loadingId,
  onConfirmPayment,
  onCancel,
  onReject,
  onAbsent,
  onAttendance,
  onForceStatusOpen,
  onRefresh,
  mobile,
}: {
  entry: Entry;
  state: DisplayState;
  tournamentId: string;
  loadingId: string | null;
  onConfirmPayment: (id: string) => void;
  onCancel: (id: string) => void;
  onReject: (id: string, reason: string | null) => void | Promise<void>;
  onAbsent: (id: string) => void;
  onAttendance: (id: string, attended: boolean) => void;
  onForceStatusOpen: () => void;
  onRefresh: () => void;
  mobile?: boolean;
}) {
  const loading = loadingId === e.id;
  const wrap = mobile ? (label: string, onClick: () => void, color: "info" | "danger" | "success" = "info") => (
    <Button type="button" label={label} color={color} small disabled={loading} onClick={onClick} />
  ) : (label: string, onClick: () => void, color: "info" | "danger" | "success" = "info") => (
    <Button type="button" label={label} color={color} small disabled={loading} onClick={onClick} />
  );

  return (
    <span className="flex flex-wrap gap-2">
      {state === "PAYMENT_MARKED" && wrap("입금확인", () => onConfirmPayment(e.id), "info")}
      {(state === "PAYMENT_PENDING" || state === "PAYMENT_MARKED") && (
        <Button
          type="button"
          label="반려"
          color="danger"
          small
          outline
          disabled={loading}
          onClick={() => {
            const reason = window.prompt("반려 사유 (선택):");
            if (reason !== null) onReject(e.id, reason.trim() || null);
          }}
        />
      )}
      {(e.status === "APPLIED" || e.status === "CONFIRMED") && (
        <Button type="button" label="취소" color="danger" small outline disabled={loading} onClick={() => onCancel(e.id)} />
      )}
      {state === "CONFIRMED" && (
        <>
          <Button type="button" label="불참" color="danger" small disabled={loading} onClick={() => onAbsent(e.id)} />
          {e.attended === null && (
            <>
              <Button type="button" label="출석" color="success" small disabled={loading} onClick={() => onAttendance(e.id, true)} />
              <Button type="button" label="결석" color="danger" small outline disabled={loading} onClick={() => onAttendance(e.id, false)} />
            </>
          )}
        </>
      )}
      <button
        type="button"
        onClick={onForceStatusOpen}
        className="text-xs text-site-text-muted hover:text-site-primary underline"
      >
        상태변경
      </button>
    </span>
  );
}

function ForceStatusModal({
  entryId,
  onClose,
  onSet,
  loading,
}: {
  entryId: string;
  onClose: () => void;
  onSet: (status: string) => void;
  loading: boolean;
}) {
  const options = [
    { value: "APPLIED", label: "신청됨(입금대기)" },
    { value: "CONFIRMED", label: "참가확정" },
    { value: "CANCELED", label: "취소" },
    { value: "REJECTED", label: "거절" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="rounded-xl bg-site-card border border-site-border shadow-xl max-w-sm w-full p-4 space-y-3" onClick={(ev) => ev.stopPropagation()}>
        <h3 className="font-semibold text-site-text">강제 상태 변경</h3>
        <p className="text-sm text-site-text-muted">해당 참가자의 상태를 직접 변경합니다. 입금 확인 흐름과 무관하게 적용됩니다.</p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={loading}
              onClick={() => onSet(opt.value)}
              className="rounded-lg border border-site-border px-3 py-2 text-sm font-medium hover:bg-site-bg disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="w-full rounded-lg border border-site-border py-2 text-sm">
          닫기
        </button>
      </div>
    </div>
  );
}
