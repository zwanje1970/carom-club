"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKoreanDateTime } from "@/lib/format-date";
import {
  ConsoleActionBar,
  ConsoleBadge,
  ConsoleFilterBar,
  ConsolePageHeader,
  ConsoleSection,
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextMuted } from "@/components/client/console/ui/tokens";
import { DEFAULT_ADMIN_COPY, fillAdminCopyTemplate, getCopyValue } from "@/lib/admin-copy";
import {
  getUnassignedDivisionLabel,
  groupEntriesByDivision,
  sortEntriesByDivision,
} from "@/lib/tournament-division-grouping";
import {
  type OperationsPhaseView,
  type TournamentOperationPhaseSnapshot,
} from "@/lib/client-tournament-operation-phase";

export type ConsoleParticipantRow = {
  id: string;
  userId: string;
  userName: string;
  displayName?: string | null;
  playerAName?: string | null;
  playerBName?: string | null;
  userPhone: string | null;
  userEmail: string | null;
  handicap: string | null;
  avg: string | null;
  avgProofUrl: string | null;
  depositorName: string | null;
  clubOrAffiliation: string | null;
  round: string | null;
  status: string;
  waitingListOrder: number | null;
  slotNumber: number;
  paymentMarkedByApplicantAt: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  attended: boolean | null;
  verificationImageUrl: string | null;
  verificationOcrText: string | null;
  verificationOcrStatus: string | null;
  verificationReviewStatus: string | null;
  divisionName: string | null;
  divisionMatchedValue: number | null;
  divisionMatchedAverage: number | null;
};

type DisplayState =
  | "PAYMENT_PENDING"
  | "PAYMENT_MARKED"
  | "CONFIRMED"
  | "WAITING"
  | "CANCELED";

function getDisplayState(e: ConsoleParticipantRow): DisplayState {
  if (e.status === "CANCELED" || e.status === "REJECTED") return "CANCELED";
  if (e.status === "CONFIRMED") return "CONFIRMED";
  if (e.status === "APPLIED") {
    if (e.paidAt != null) return e.waitingListOrder != null ? "WAITING" : "CONFIRMED";
    if (e.paymentMarkedByApplicantAt != null) return "PAYMENT_MARKED";
    return "PAYMENT_PENDING";
  }
  return "CANCELED";
}

function entryStatusLabel(e: ConsoleParticipantRow): string {
  const state = getDisplayState(e);
  switch (state) {
    case "PAYMENT_PENDING":
      return "신청(입금전)";
    case "PAYMENT_MARKED":
      return "입금확인대기";
    case "CONFIRMED":
      return "참가확정";
    case "WAITING":
      return `대기 ${e.waitingListOrder ?? "-"}번`;
    case "CANCELED":
      return e.status === "REJECTED" ? "반려" : "취소";
    default:
      return e.status;
  }
}

function paymentColumnLabel(e: ConsoleParticipantRow): string {
  if (e.paidAt) return "입금확인됨";
  if (e.paymentMarkedByApplicantAt) return "신청자 입금표시";
  return "미표시";
}

function approvalColumnLabel(e: ConsoleParticipantRow): string {
  if (e.status === "CONFIRMED") return "승인(확정)";
  if (e.status === "REJECTED") return "반려";
  if (e.status === "CANCELED") return "취소";
  if (e.status === "APPLIED" && e.paidAt && e.waitingListOrder != null) return "대기(입금확인)";
  if (e.status === "APPLIED" && e.paymentMarkedByApplicantAt) return "승인대기";
  return "처리전";
}

type SortKey =
  | "default"
  | "division"
  | "averageDesc"
  | "createdAt"
  | "paymentMarkedAt"
  | "paidAt"
  | "depositorName"
  | "waitingListOrder"
  | "confirmedAt";

type FilterKey = "" | DisplayState | "APPROVAL_PENDING";

const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: "", label: "전체" },
  { value: "APPROVAL_PENDING", label: "승인대기만" },
  { value: "PAYMENT_PENDING", label: "입금전" },
  { value: "PAYMENT_MARKED", label: "입금확인대기" },
  { value: "WAITING", label: "대기자" },
  { value: "CONFIRMED", label: "확정" },
  { value: "CANCELED", label: "취소·반려" },
];

export function ClientOperationsParticipantsPanel({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
  listHref?: string;
  operationPhase?: {
    snapshot: TournamentOperationPhaseSnapshot;
    currentView: OperationsPhaseView;
  };
}) {
  const [rows, setRows] = useState<ConsoleParticipantRow[]>([]);
  const [meta, setMeta] = useState<{
    maxParticipants: number | null;
    useWaiting: boolean;
    tournamentStatus: string;
    participantRosterLockedAt: string | null;
    verificationMode: string;
    verificationReviewRequired: boolean;
    divisionEnabled: boolean;
    divisionMetricType: string;
    divisionRulesJson: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("");
  const [sort, setSort] = useState<SortKey>("default");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/participants`);
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "목록을 불러오지 못했습니다.");
        setRows([]);
        setMeta(null);
        return;
      }
      setRows((data as { entries: ConsoleParticipantRow[] }).entries ?? []);
      setMeta((data as { tournament: typeof meta }).tournament ?? null);
    } catch {
      setError("네트워크 오류");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!meta) return;
    if (meta.divisionEnabled) setSort("division");
    else setSort("default");
  }, [meta?.divisionEnabled]);

  const filteredSorted = useMemo(() => {
    let list = [...rows];
    if (filter === "APPROVAL_PENDING") {
      list = list.filter((e) => getDisplayState(e) === "PAYMENT_MARKED");
    } else if (filter) {
      list = list.filter((e) => getDisplayState(e) === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.displayName && e.displayName.toLowerCase().includes(q)) ||
          e.userName.toLowerCase().includes(q) ||
          (e.depositorName && e.depositorName.toLowerCase().includes(q)) ||
          (e.userPhone && e.userPhone.includes(q)) ||
          (e.userEmail && e.userEmail.toLowerCase().includes(q)) ||
          (e.clubOrAffiliation && e.clubOrAffiliation.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      switch (sort) {
        case "default":
          return 0;
        case "averageDesc": {
          const aa = a.divisionMatchedValue ?? a.divisionMatchedAverage;
          const bb = b.divisionMatchedValue ?? b.divisionMatchedAverage;
          if (aa == null && bb == null) return 0;
          if (aa == null) return 1;
          if (bb == null) return -1;
          return bb - aa;
        }
        case "createdAt":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "depositorName":
          return (
            (a.depositorName ?? "").localeCompare(b.depositorName ?? "", "ko") ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "paymentMarkedAt": {
          const pa = a.paymentMarkedByApplicantAt ? new Date(a.paymentMarkedByApplicantAt).getTime() : 0;
          const pb = b.paymentMarkedByApplicantAt ? new Date(b.paymentMarkedByApplicantAt).getTime() : 0;
          return pa - pb || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        case "paidAt": {
          const pa = a.paidAt ? new Date(a.paidAt).getTime() : 0;
          const pb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
          return pa - pb || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        case "confirmedAt": {
          const ra = a.reviewedAt && a.status === "CONFIRMED" ? new Date(a.reviewedAt).getTime() : 0;
          const rb = b.reviewedAt && b.status === "CONFIRMED" ? new Date(b.reviewedAt).getTime() : 0;
          return ra - rb;
        }
        case "waitingListOrder":
          return (a.waitingListOrder ?? 9999) - (b.waitingListOrder ?? 9999);
        default:
          return 0;
      }
    });
    if (meta?.divisionEnabled && sort === "division") {
      return sortEntriesByDivision(list, meta.divisionRulesJson);
    }
    return list;
  }, [rows, filter, search, sort, meta?.divisionEnabled, meta?.divisionRulesJson]);

  const toggleAllVisible = () => {
    const allSelected = filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSorted.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bracketGenerated = meta?.tournamentStatus === "BRACKET_GENERATED";
  const rosterLocked = Boolean(meta?.participantRosterLockedAt);
  const actionsDisabled = bracketGenerated || rosterLocked;

  async function postBulk(action: "confirm" | "cancel" | "reject" | "promote_wait", ids: string[], rejectionReason?: string | null) {
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/participants/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entryIds: ids, rejectionReason: rejectionReason ?? null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "일괄 처리 실패");
        return;
      }
      const results = (data as { results?: { entryId: string; ok: boolean; error?: string }[] }).results ?? [];
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(
          `${failed.length}건 실패: ${failed.slice(0, 3).map((f) => f.error ?? "?").join("; ")}${failed.length > 3 ? "…" : ""}`
        );
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function singleAction(
    entryId: string,
    path: string,
    method: "POST" = "POST",
    body?: Record<string, unknown>
  ) {
    setLoadingId(entryId);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error || "처리 실패");
        return;
      }
      await load();
    } finally {
      setLoadingId(null);
    }
  }

  const counts = useMemo(() => {
    let paymentPending = 0;
    let paymentMarked = 0;
    let confirmed = 0;
    let waiting = 0;
    let canceled = 0;
    rows.forEach((e) => {
      const s = getDisplayState(e);
      if (s === "PAYMENT_PENDING") paymentPending++;
      else if (s === "PAYMENT_MARKED") paymentMarked++;
      else if (s === "CONFIRMED") confirmed++;
      else if (s === "WAITING") waiting++;
      else canceled++;
    });
    return { paymentPending, paymentMarked, confirmed, waiting, canceled };
  }, [rows]);

  const unassignedDivisionLabel = getCopyValue(DEFAULT_ADMIN_COPY, "client.operations.participants.unassignedDivision");
  const grouped = useMemo(() => {
    if (!meta?.divisionEnabled) return null;
    return groupEntriesByDivision(
      filteredSorted,
      meta.divisionRulesJson,
      getUnassignedDivisionLabel(unassignedDivisionLabel)
    );
  }, [meta?.divisionEnabled, meta?.divisionRulesJson, filteredSorted, unassignedDivisionLabel]);


  if (loading) {
    return <p className={cx(consoleTextMuted, "py-12 text-center text-sm")}>불러오는 중…</p>;
  }

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="대회 운영"
        title="참가자 관리(운영)"
        description={`「${tournamentName}」`}
      />

      {rosterLocked && (
        <p className="rounded-sm border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 dark:border-zinc-500 dark:bg-zinc-900">
          참가 명단이 <strong>확정</strong>되었습니다. 입금확인·취소·반려·대기 승격은 비활성화됩니다. (대진표 생성은 확정 스냅샷과 현재
          확정자 목록이 일치할 때만 가능합니다.)
        </p>
      )}
      {bracketGenerated && (
        <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          대진표가 생성된 대회입니다. 참가 전 처리는 더 이상 변경할 수 없습니다.
        </p>
      )}

      {error && (
        <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}
      {meta?.divisionEnabled && grouped && grouped.rules.length === 0 && (
        <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          자동 부 분배가 켜져 있으나 규칙이 비어 있어 기존 목록 표시로 대체합니다.
        </p>
      )}
      {meta?.divisionEnabled && grouped?.hasUnknownDivisionName && (
        <p className="rounded-sm border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          현재 부 규칙에 없는 저장 divisionName 항목이 있어 미배정 그룹으로 표시했습니다.
        </p>
      )}

      <ConsoleFilterBar>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              disabled={busy}
              onClick={() => setFilter(opt.value)}
              className={cx(
                "rounded-sm border px-2.5 py-1 text-[11px] font-medium",
                filter === opt.value
                  ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              {opt.label}
              {opt.value === "PAYMENT_MARKED" && counts.paymentMarked > 0 ? ` (${counts.paymentMarked})` : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700 sm:border-0 sm:pt-0">
          <label className="text-[11px] text-zinc-500">정렬</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-sm border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
          >
            <option value="default">{getCopyValue(DEFAULT_ADMIN_COPY, "client.operations.participants.sortByDefault")}</option>
            {meta?.divisionEnabled && (
              <option value="division">{getCopyValue(DEFAULT_ADMIN_COPY, "client.operations.participants.sortByDivision")}</option>
            )}
            <option value="averageDesc">{getCopyValue(DEFAULT_ADMIN_COPY, "client.operations.participants.sortByAverage")}</option>
            <option value="createdAt">신청순</option>
            <option value="paymentMarkedAt">입금표시 시각순</option>
            <option value="paidAt">입금확인(관리자) 시각순</option>
            <option value="depositorName">입금자명순</option>
            <option value="confirmedAt">확정 처리순</option>
            <option value="waitingListOrder">대기 순번순</option>
          </select>
          <input
            type="search"
            placeholder="이름·전화·이메일·입금자명"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-sm border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950 sm:max-w-xs"
          />
        </div>
      </ConsoleFilterBar>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        총 <strong className="text-zinc-800 dark:text-zinc-200">{rows.length}</strong>명 · 확정{" "}
        <strong>{counts.confirmed}</strong> · 대기 <strong>{counts.waiting}</strong> · 입금확인대기{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">{counts.paymentMarked}</strong>
        {meta?.maxParticipants != null && meta.maxParticipants > 0 && (
          <> · 정원 {meta.maxParticipants}명</>
        )}
        {meta?.useWaiting ? " · 대기 허용" : ""}
      </p>

      <div className="grid gap-4">
        <ConsoleSection title="참가자 표" flush>
          {filteredSorted.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">조건에 맞는 참가자가 없습니다.</div>
          ) : (
            <ConsoleTable>
              <ConsoleTableHead>
                <ConsoleTableRow>
                  <ConsoleTableTh className="w-10">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-400"
                      checked={
                        filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id))
                      }
                      onChange={toggleAllVisible}
                      aria-label="현재 목록 전체 선택"
                    />
                  </ConsoleTableTh>
                  <ConsoleTableTh>이름</ConsoleTableTh>
                  <ConsoleTableTh>연락처·식별</ConsoleTableTh>
                  <ConsoleTableTh>부/슬롯</ConsoleTableTh>
                  <ConsoleTableTh>신청</ConsoleTableTh>
                  <ConsoleTableTh>입금</ConsoleTableTh>
                  <ConsoleTableTh>승인</ConsoleTableTh>
                  <ConsoleTableTh>대기</ConsoleTableTh>
                  <ConsoleTableTh>신청 시각</ConsoleTableTh>
                  <ConsoleTableTh>입금 시각</ConsoleTableTh>
                  <ConsoleTableTh className="text-right">작업</ConsoleTableTh>
                </ConsoleTableRow>
              </ConsoleTableHead>
              <ConsoleTableBody>
                {(() => {
                  if (meta?.divisionEnabled && grouped && grouped.rules.length > 0) {
                    return grouped.groups.flatMap((g) => {
                      const header = (
                        <ConsoleTableRow key={`group-${g.key}`}>
                          <ConsoleTableTd colSpan={11} className="bg-zinc-50 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {fillAdminCopyTemplate(
                              getCopyValue(DEFAULT_ADMIN_COPY, "client.operations.participants.divisionCountFormat"),
                              { name: g.label, count: g.entries.length }
                            )}
                          </ConsoleTableTd>
                        </ConsoleTableRow>
                      );
                      const rowsEl = g.entries.map((e) => {
                        const state = getDisplayState(e);
                        const rowBusy = busy || loadingId === e.id;
                        return (
                          <ConsoleTableRow key={e.id}>
                            <ConsoleTableTd>
                              <input
                                type="checkbox"
                                className="rounded border-zinc-400"
                                checked={selected.has(e.id)}
                                onChange={() => toggleRow(e.id)}
                                disabled={busy}
                              />
                            </ConsoleTableTd>
                            <ConsoleTableTd className="max-w-[7rem] font-medium">
                              <span className="line-clamp-2">
                                {e.displayName ?? (e.slotNumber > 1 ? `${e.userName} (슬롯${e.slotNumber})` : e.userName)}
                              </span>
                            </ConsoleTableTd>
                            <ConsoleTableTd className="max-w-[9rem] text-[11px]">
                              <div className="line-clamp-2">{e.userPhone ?? "—"}</div>
                              {e.userEmail && (
                                <div className="line-clamp-1 text-zinc-500 dark:text-zinc-400">{e.userEmail}</div>
                              )}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="whitespace-nowrap text-[11px]">
                              {e.divisionName ?? unassignedDivisionLabel}
                              {" · "}
                              {e.round?.trim() || `슬롯 ${e.slotNumber}`}
                              {(e.divisionMatchedValue ?? e.divisionMatchedAverage) != null && (
                                <> · 기준 {(e.divisionMatchedValue ?? e.divisionMatchedAverage)!.toFixed(3)}</>
                              )}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="text-[11px]">{e.status}</ConsoleTableTd>
                            <ConsoleTableTd className="text-[11px]">{paymentColumnLabel(e)}</ConsoleTableTd>
                            <ConsoleTableTd className="text-[11px]">{approvalColumnLabel(e)}</ConsoleTableTd>
                            <ConsoleTableTd>
                              {state === "WAITING" ? (
                                <ConsoleBadge tone="info">대기 {e.waitingListOrder ?? "-"}</ConsoleBadge>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
                              {formatKoreanDateTime(e.createdAt)}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
                              {e.paidAt
                                ? formatKoreanDateTime(e.paidAt)
                                : e.paymentMarkedByApplicantAt
                                  ? `표시 ${formatKoreanDateTime(e.paymentMarkedByApplicantAt)}`
                                  : "—"}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {!actionsDisabled && state === "PAYMENT_MARKED" && (
                                  <button
                                    type="button"
                                    disabled={rowBusy || busy}
                                    className="rounded-sm border border-zinc-600 bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-600"
                                    onClick={() =>
                                      singleAction(
                                        e.id,
                                        `/api/client/tournaments/${tournamentId}/participants/${e.id}/confirm`,
                                        "POST"
                                      )
                                    }
                                  >
                                    입금확인
                                  </button>
                                )}
                                {!actionsDisabled && (state === "PAYMENT_PENDING" || state === "PAYMENT_MARKED") && (
                                  <button
                                    type="button"
                                    disabled={rowBusy || busy}
                                    className="rounded-sm border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                                    onClick={() => {
                                      const reason = window.prompt("반려 사유 (선택):");
                                      if (reason === null) return;
                                      void singleAction(
                                        e.id,
                                        `/api/client/tournaments/${tournamentId}/participants/${e.id}/reject`,
                                        "POST",
                                        { rejectionReason: reason.trim() || null }
                                      );
                                    }}
                                  >
                                    반려
                                  </button>
                                )}
                                {!actionsDisabled && state === "WAITING" && (
                                  <button
                                    type="button"
                                    disabled={rowBusy || busy}
                                    className="rounded-sm border border-emerald-600 px-2 py-0.5 text-[10px] font-medium text-emerald-800 disabled:opacity-40 dark:text-emerald-200"
                                    onClick={() =>
                                      singleAction(
                                        e.id,
                                        `/api/client/tournaments/${tournamentId}/participants/${e.id}/promote`,
                                        "POST"
                                      )
                                    }
                                  >
                                    대기승격
                                  </button>
                                )}
                                {!actionsDisabled && (e.status === "APPLIED" || e.status === "CONFIRMED") && (
                                  <button
                                    type="button"
                                    disabled={rowBusy || busy}
                                    className="rounded-sm border border-red-300 px-2 py-0.5 text-[10px] text-red-700 dark:border-red-800 dark:text-red-300"
                                    onClick={() => {
                                      if (!confirm("이 신청을 취소 처리할까요?")) return;
                                      void singleAction(
                                        e.id,
                                        `/api/client/tournaments/${tournamentId}/participants/${e.id}/cancel`,
                                        "POST"
                                      );
                                    }}
                                  >
                                    취소
                                  </button>
                                )}
                              </div>
                            </ConsoleTableTd>
                          </ConsoleTableRow>
                        );
                      });
                      return [header, ...rowsEl];
                    });
                  }
                  return filteredSorted.map((e) => {
                  const state = getDisplayState(e);
                  const rowBusy = busy || loadingId === e.id;
                  return (
                    <ConsoleTableRow key={e.id}>
                      <ConsoleTableTd>
                        <input
                          type="checkbox"
                          className="rounded border-zinc-400"
                          checked={selected.has(e.id)}
                          onChange={() => toggleRow(e.id)}
                          disabled={busy}
                        />
                      </ConsoleTableTd>
                      <ConsoleTableTd className="max-w-[7rem] font-medium">
                        <span className="line-clamp-2">
                          {e.displayName ?? (e.slotNumber > 1 ? `${e.userName} (슬롯${e.slotNumber})` : e.userName)}
                        </span>
                      </ConsoleTableTd>
                      <ConsoleTableTd className="max-w-[9rem] text-[11px]">
                        <div className="line-clamp-2">{e.userPhone ?? "—"}</div>
                        {e.userEmail && (
                          <div className="line-clamp-1 text-zinc-500 dark:text-zinc-400">{e.userEmail}</div>
                        )}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="whitespace-nowrap text-[11px]">
                        {e.round?.trim() || `슬롯 ${e.slotNumber}`}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="text-[11px]">{e.status}</ConsoleTableTd>
                      <ConsoleTableTd className="text-[11px]">{paymentColumnLabel(e)}</ConsoleTableTd>
                      <ConsoleTableTd className="text-[11px]">{approvalColumnLabel(e)}</ConsoleTableTd>
                      <ConsoleTableTd>
                        {state === "WAITING" ? (
                          <ConsoleBadge tone="info">대기 {e.waitingListOrder ?? "-"}</ConsoleBadge>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
                        {formatKoreanDateTime(e.createdAt)}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
                        {e.paidAt
                          ? formatKoreanDateTime(e.paidAt)
                          : e.paymentMarkedByApplicantAt
                            ? `표시 ${formatKoreanDateTime(e.paymentMarkedByApplicantAt)}`
                            : "—"}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!actionsDisabled && state === "PAYMENT_MARKED" && (
                            <button
                              type="button"
                              disabled={rowBusy || busy}
                              className="rounded-sm border border-zinc-600 bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-40 dark:border-zinc-500 dark:bg-zinc-600"
                              onClick={() =>
                                singleAction(
                                  e.id,
                                  `/api/client/tournaments/${tournamentId}/participants/${e.id}/confirm`,
                                  "POST"
                                )
                              }
                            >
                              입금확인
                            </button>
                          )}
                          {!actionsDisabled && (state === "PAYMENT_PENDING" || state === "PAYMENT_MARKED") && (
                            <button
                              type="button"
                              disabled={rowBusy || busy}
                              className="rounded-sm border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                              onClick={() => {
                                const reason = window.prompt("반려 사유 (선택):");
                                if (reason === null) return;
                                void singleAction(
                                  e.id,
                                  `/api/client/tournaments/${tournamentId}/participants/${e.id}/reject`,
                                  "POST",
                                  { rejectionReason: reason.trim() || null }
                                );
                              }}
                            >
                              반려
                            </button>
                          )}
                          {!actionsDisabled && state === "WAITING" && (
                            <button
                              type="button"
                              disabled={rowBusy || busy}
                              className="rounded-sm border border-emerald-600 px-2 py-0.5 text-[10px] font-medium text-emerald-800 disabled:opacity-40 dark:text-emerald-200"
                              onClick={() =>
                                singleAction(
                                  e.id,
                                  `/api/client/tournaments/${tournamentId}/participants/${e.id}/promote`,
                                  "POST"
                                )
                              }
                            >
                              대기승격
                            </button>
                          )}
                          {!actionsDisabled && (e.status === "APPLIED" || e.status === "CONFIRMED") && (
                            <button
                              type="button"
                              disabled={rowBusy || busy}
                              className="rounded-sm border border-red-300 px-2 py-0.5 text-[10px] text-red-700 dark:border-red-800 dark:text-red-300"
                              onClick={() => {
                                if (!confirm("이 신청을 취소 처리할까요?")) return;
                                void singleAction(
                                  e.id,
                                  `/api/client/tournaments/${tournamentId}/participants/${e.id}/cancel`,
                                  "POST"
                                );
                              }}
                            >
                              취소
                            </button>
                          )}
                        </div>
                      </ConsoleTableTd>
                    </ConsoleTableRow>
                  );
                  });
                })()}
              </ConsoleTableBody>
            </ConsoleTable>
          )}
        </ConsoleSection>
      </div>

      <ConsoleActionBar
        left={
          <>
            <span>
              선택 <strong>{selected.size}</strong>건
            </span>
          </>
        }
        right={
          !actionsDisabled ? (
            <>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                className="rounded-sm border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                onClick={() => {
                  const ids = [...selected].filter((id) => {
                    const row = rows.find((r) => r.id === id);
                    return row && getDisplayState(row) === "PAYMENT_MARKED";
                  });
                  if (ids.length === 0) {
                    alert("입금확인대기 상태인 선택 행이 없습니다.");
                    return;
                  }
                  if (!confirm(`${ids.length}건 입금확인(승인 처리)할까요?`)) return;
                  void postBulk("confirm", ids);
                }}
              >
                선택 → 입금확인
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                className="rounded-sm border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-800 disabled:opacity-40 dark:text-emerald-200"
                onClick={() => {
                  const ids = [...selected].filter((id) => {
                    const row = rows.find((r) => r.id === id);
                    return row && getDisplayState(row) === "WAITING";
                  });
                  if (ids.length === 0) {
                    alert("대기 상태인 선택 행이 없습니다.");
                    return;
                  }
                  if (!confirm(`${ids.length}건 대기에서 확정으로 승격할까요? (정원 여유 필요)`)) return;
                  void postBulk("promote_wait", ids);
                }}
              >
                선택 → 대기승격
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                className="rounded-sm border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 disabled:opacity-40 dark:border-red-800 dark:text-red-300"
                onClick={() => {
                  if (!confirm(`${selected.size}건 취소 처리할까요?`)) return;
                  void postBulk("cancel", [...selected]);
                }}
              >
                선택 → 취소
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                className="rounded-sm border border-zinc-400 px-3 py-1.5 text-xs text-zinc-800 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
                onClick={() => {
                  const reason = window.prompt("일괄 반려 사유 (선택, 공통 적용):");
                  if (reason === null) return;
                  const ids = [...selected].filter((id) => {
                    const row = rows.find((r) => r.id === id);
                    return row && row.status === "APPLIED";
                  });
                  if (ids.length === 0) {
                    alert("신청(APPLIED) 상태인 선택 행이 없습니다.");
                    return;
                  }
                  if (!confirm(`${ids.length}건 반려할까요?`)) return;
                  void postBulk("reject", ids, reason.trim() || null);
                }}
              >
                선택 → 반려
              </button>
            </>
          ) : null
        }
      />
    </div>
  );
}
