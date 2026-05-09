"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TournamentApplicationListItem, TournamentStatusBadge } from "../../../../lib/types/entities";
import type { TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";
import {
  countCapacityOccupiedFromListItems,
  countPendingOperatorApplicationApproval,
} from "./client-participant-filter-shared";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantAddSheet from "./participants/ParticipantAddSheet";
import ApplicationsTableOrientationLock, {
  type ApplicationsTableLandscapePhase,
} from "./participants/ApplicationsTableOrientationLock";

export type ParticipantCountSummary = {
  total: number;
  approved: number;
  wait: number;
  reject: number;
  waitingList?: number;
};

type TournamentZoneListEntry = {
  id: string;
  zoneName: string;
  status: string;
};

const CLOSED_BADGES: TournamentStatusBadge[] = ["마감", "진행중", "종료"];

type Props = {
  tournamentId: string;
  tournamentTitle: string;
  maxParticipants: number;
  entryQualificationType: TournamentEntryQualificationType;
  initialEntries: TournamentApplicationListItem[];
  participantCountSummary: ParticipantCountSummary;
  zonesEnabled: boolean;
  tournamentStatusBadge: TournamentStatusBadge;
  hasActiveBracket?: boolean;
  /** 표 전용 전체화면(가로보기) — 항상 넓은 열 구성 */
  variant?: "standard" | "fullscreenTable";
};

const participantApplicationsTableThBase: CSSProperties = {
  padding: "0.42rem 0.28rem",
  fontSize: "0.76rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const opsBtn: CSSProperties = {
  minHeight: 31,
  padding: "0.18rem 0.28rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  borderRadius: "0.28rem",
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  boxShadow: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation",
  whiteSpace: "nowrap",
};

function bracketScaleLabel(maxParticipants: number): string {
  const k = Math.floor(Number(maxParticipants));
  if (!Number.isFinite(k) || k <= 0) return "—";
  return `${k}강`;
}

function mergeByEntryId(
  a: TournamentApplicationListItem[],
  b: TournamentApplicationListItem[]
): TournamentApplicationListItem[] {
  const map = new Map<string, TournamentApplicationListItem>();
  for (const e of a) map.set(e.id, e);
  for (const e of b) map.set(e.id, e);
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 목록 항목의 입금/신청승인 시각 — 문자열 외 직렬화 형태 보정(전체승인 대상 판정만, 타입 정의는 유지) */
function coerceClientProcessingIsoAt(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.toDate === "function") {
      try {
        const d = (o.toDate as () => Date)();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
      } catch {
        /* ignore */
      }
    }
    const sec = o._seconds;
    const nano = o._nanoseconds;
    if (typeof sec === "number" && Number.isFinite(sec)) {
      const ms = typeof nano === "number" && Number.isFinite(nano) ? sec * 1000 + Math.floor(nano / 1e6) : sec * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function countApplicationApprovedChip(entries: TournamentApplicationListItem[]): number {
  return entries.filter(
    (e) =>
      e.status === "APPROVED" ||
      (typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "")
  ).length;
}

/**
 * 입금확인 전체승인 대상: 입금확인 시각 있음 · 신청 승인 시각 없음 · 거절(REJECTED)·참가확정(APPROVED)·대기자(WAITING) 제외.
 * (patchTournamentApplicationProcessingFirestore: WAITING·REJECTED·APPROVED 는 신청 승인 불가)
 */
function listItemEligibleBulkDepositApprove(e: TournamentApplicationListItem): boolean {
  if (e.status === "REJECTED" || e.status === "APPROVED" || e.status === "WAITING") return false;
  const depAt = coerceClientProcessingIsoAt(e.clientDepositConfirmedAt as unknown);
  if (!depAt) return false;
  const apprAt = coerceClientProcessingIsoAt(e.clientApplicationApprovedAt as unknown);
  if (apprAt) return false;
  return true;
}

function participantMetricColumnTitle(eq: TournamentEntryQualificationType): string {
  if (eq === "SCORE") return "점수";
  if (eq === "EVER") return "AVG";
  if (eq === "BOTH") return "점수·AVG";
  return "AVG";
}

const pillBase: CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 700,
  padding: "0.1rem 0.34rem",
  borderRadius: "999px",
  border: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

export default function ClientTournamentParticipantsApplicationsBlock({
  tournamentId,
  tournamentTitle,
  maxParticipants,
  entryQualificationType,
  initialEntries,
  participantCountSummary,
  zonesEnabled,
  tournamentStatusBadge,
  hasActiveBracket = false,
  variant = "standard",
}: Props) {
  const router = useRouter();
  const metricColumnTitle = participantMetricColumnTitle(entryQualificationType);
  const [entries, setEntries] = useState<TournamentApplicationListItem[]>(initialEntries);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeUnapprovedModalCount, setFinalizeUnapprovedModalCount] = useState<number | null>(null);
  const [bulkApproveBusy, setBulkApproveBusy] = useState(false);
  const [bulkDepositApproveModalOpen, setBulkDepositApproveModalOpen] = useState(false);
  const [bulkDepositApproveTargetIds, setBulkDepositApproveTargetIds] = useState<string[]>([]);
  const [moreLoading, setMoreLoading] = useState(() => participantCountSummary.total > initialEntries.length);
  const fullFetchDoneRef = useRef(false);

  useEffect(() => {
    setEntries((prev) => mergeByEntryId(initialEntries, prev));
  }, [initialEntries]);

  useEffect(() => {
    fullFetchDoneRef.current = false;
  }, [tournamentId]);

  useEffect(() => {
    if (participantCountSummary.total <= initialEntries.length) {
      setMoreLoading(false);
      return;
    }
    if (fullFetchDoneRef.current) return;
    let cancelled = false;
    setMoreLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/applications/list-items`,
          { credentials: "same-origin" }
        );
        const json = (await res.json()) as
          | { ok: true; entries: TournamentApplicationListItem[] }
          | { ok: false; error?: string };
        if (!res.ok || !json || json.ok !== true || !Array.isArray(json.entries)) {
          return;
        }
        if (cancelled) return;
        setEntries((prev) => mergeByEntryId(json.entries, prev));
        fullFetchDoneRef.current = true;
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setMoreLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, participantCountSummary.total, initialEntries.length]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );

  const [zones, setZones] = useState<TournamentZoneListEntry[]>([]);
  const [zoneFilterZoneId, setZoneFilterZoneId] = useState<string>("all");

  useEffect(() => {
    if (!zonesEnabled) {
      setZones([]);
      setZoneFilterZoneId("all");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/zones`,
          { credentials: "same-origin" }
        );
        const json = (await res.json()) as { zones?: unknown; error?: string };
        if (!res.ok || cancelled || !json || !Array.isArray(json.zones)) {
          return;
        }
        const parsed: TournamentZoneListEntry[] = [];
        for (const z of json.zones) {
          if (!z || typeof z !== "object") continue;
          const o = z as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id.trim() : "";
          const zoneName = typeof o.zoneName === "string" ? o.zoneName.trim() : "";
          const status = typeof o.status === "string" ? o.status.trim() : "";
          if (id && zoneName) parsed.push({ id, zoneName, status });
        }
        setZones(parsed);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, zonesEnabled]);

  const activeZones = useMemo(() => zones.filter((z) => z.status === "ACTIVE"), [zones]);

  const zoneFilteredEntries = useMemo(() => {
    if (!zonesEnabled || zoneFilterZoneId === "all") return sortedEntries;
    return sortedEntries.filter((e) => (e.zoneId ?? "").trim() === zoneFilterZoneId);
  }, [sortedEntries, zonesEnabled, zoneFilterZoneId]);

  const chipApproved = countApplicationApprovedChip(entries);
  const printHref = `/client/tournaments/${encodeURIComponent(tournamentId)}/participants/print`;
  const tableViewHref = `/client/tournaments/${encodeURIComponent(tournamentId)}/participants/table-view`;
  const showFinalize = !CLOSED_BADGES.includes(tournamentStatusBadge);
  const showCancelFinalize = tournamentStatusBadge === "마감";
  const fullscreenTable = variant === "fullscreenTable";
  const [tableLandscapePhase, setTableLandscapePhase] = useState<ApplicationsTableLandscapePhase>(() =>
    fullscreenTable ? "pending" : "ready",
  );
  const rowLayout = fullscreenTable ? "fullscreen" : "standard";
  const capacityOccupied = useMemo(() => countCapacityOccupiedFromListItems(entries), [entries]);
  const waitingListTotal = participantCountSummary.waitingList ?? 0;

  function requestBulkDepositApprove() {
    if (bulkApproveBusy) return;
    const targets = zoneFilteredEntries.filter(listItemEligibleBulkDepositApprove);
    if (targets.length === 0) {
      window.alert("입금확인 된 미승인자가 없습니다.");
      return;
    }
    setBulkDepositApproveTargetIds(targets.map((t) => t.id));
    setBulkDepositApproveModalOpen(true);
  }

  async function executeBulkDepositApproveAfterConfirm() {
    if (bulkApproveBusy) return;
    const ids = [...bulkDepositApproveTargetIds];
    if (ids.length === 0) {
      setBulkDepositApproveModalOpen(false);
      setBulkDepositApproveTargetIds([]);
      return;
    }
    setBulkDepositApproveModalOpen(false);
    setBulkDepositApproveTargetIds([]);
    setBulkApproveBusy(true);
    try {
      for (const id of ids) {
        const t = entries.find((e) => e.id === id);
        if (!t || !listItemEligibleBulkDepositApprove(t)) continue;
        const res = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(t.id)}/processing`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationApproved: true }),
            credentials: "same-origin",
          }
        );
        const json = (await res.json()) as {
          error?: string;
          application?: { clientApplicationApprovedAt?: string | null };
        };
        if (!res.ok) {
          window.alert(json.error ?? "일괄 승인 중 저장에 실패했습니다.");
          router.refresh();
          return;
        }
        const at = json.application?.clientApplicationApprovedAt;
        if (typeof at === "string" && at.trim()) {
          setEntries((prev) =>
            prev.map((e) => (e.id === t.id ? { ...e, clientApplicationApprovedAt: at.trim() } : e))
          );
        }
      }
      router.refresh();
    } catch {
      window.alert("일괄 승인 처리 중 오류가 발생했습니다.");
      router.refresh();
    } finally {
      setBulkApproveBusy(false);
    }
  }

  function cancelBulkDepositApproveModal() {
    setBulkDepositApproveModalOpen(false);
    setBulkDepositApproveTargetIds([]);
  }

  async function runFinalizeParticipantsCore() {
    const pr = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/promote-confirmed`, {
      method: "POST",
      credentials: "same-origin",
    });
    const pj = (await pr.json()) as { error?: string };
    if (!pr.ok) {
      window.alert(pj.error ?? "참가자 반영에 실패했습니다.");
      return;
    }

    const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusBadge: "마감" }),
      credentials: "same-origin",
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      window.alert(data.error ?? "저장에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  async function onFinalizeParticipants() {
    if (finalizeBusy) return;
    const pendingApproval = countPendingOperatorApplicationApproval(zoneFilteredEntries);
    if (pendingApproval > 0) {
      setFinalizeUnapprovedModalCount(pendingApproval);
      return;
    }
    if (
      !window.confirm(
        "참가자를 확정하시겠습니까?\n확정 후에는 신청이 마감되며 대진표 생성이 활성화됩니다."
      )
    ) {
      return;
    }
    setFinalizeBusy(true);
    try {
      await runFinalizeParticipantsCore();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setFinalizeBusy(false);
    }
  }

  async function onCancelFinalizeParticipants() {
    if (finalizeBusy) return;
    if (!window.confirm("참가 확정을 취소하고 대회를 「모집중」으로 되돌릴까요?\n참가 확정(APPROVED) 상태였던 신청은 확정 전 단계로 되돌아갑니다.")) {
      return;
    }
    setFinalizeBusy(true);
    try {
      const dr = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/demote-confirmed`, {
        method: "POST",
        credentials: "same-origin",
      });
      const dj = (await dr.json()) as { error?: string };
      if (!dr.ok) {
        window.alert(dj.error ?? "취소 처리에 실패했습니다.");
        return;
      }
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: "모집중" }),
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "저장에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setFinalizeBusy(false);
    }
  }

  const titleLine = `${tournamentTitle.trim()} / ${bracketScaleLabel(maxParticipants)}`;

  return (
    <div
      className={
        fullscreenTable
          ? "client-tournament-manage__participantsBlock client-tournament-manage__participantsBlock--fullscreenTable"
          : "client-tournament-manage__participantsBlock client-tournament-manage__applicationsCompactHeader client-tournament-manage__applicationsRoot"
      }
    >
      {fullscreenTable ? <ApplicationsTableOrientationLock onPhaseChange={setTableLandscapePhase} /> : null}
      <div className="client-tournament-manage__applicationsHeaderZone">
        {fullscreenTable ? (
          <div className="client-tournament-manage__fullscreenTableHead">
            <Link
              prefetch={false}
              replace
              href={`/client/tournaments/${encodeURIComponent(tournamentId)}/participants`}
              className="client-tournament-manage__fullscreenTableClose"
              style={{ ...opsBtn, flex: "0 0 auto", textDecoration: "none", fontWeight: 700 }}
            >
              ← 닫기
            </Link>
            <p className="client-tournament-manage__fullscreenTableTitle">{titleLine}</p>
          </div>
        ) : (
          <>
            <div className="client-tournament-manage__applicationsTitleRow">
              <p className="client-tournament-manage__applicationsTitle client-tournament-manage__applicationsTitle--inline">
                {titleLine}
              </p>
              <Link prefetch={false} replace href={tableViewHref} className="client-tournament-manage__applicationsTableViewLink">
                가로보기
              </Link>
            </div>
            <div className="client-tournament-manage__applicationsOpsRows">
              <div className="client-tournament-manage__applicationsOpsRow">
                <div className="client-tournament-manage__opsBarCell">
                  <Link prefetch={false} href={printHref} className="client-tournament-manage__opsBarEqualBtn" style={{ ...opsBtn, textDecoration: "none" }}>
                    확정리스트
                  </Link>
                </div>
                <div className="client-tournament-manage__opsBarCell">
                  {showCancelFinalize ? (
                    <button
                      type="button"
                      className="client-tournament-manage__finalizeParticipantsBtn client-tournament-manage__opsBarEqualBtn"
                      disabled={finalizeBusy}
                      onClick={() => void onCancelFinalizeParticipants()}
                      style={{
                        ...opsBtn,
                        width: "100%",
                        borderColor: "#b45309",
                        background: "#fff7ed",
                        color: "#9a3412",
                        fontWeight: 800,
                      }}
                    >
                      {finalizeBusy ? "처리 중…" : "참가확정 취소"}
                    </button>
                  ) : showFinalize ? (
                    <button
                      type="button"
                      className="client-tournament-manage__finalizeParticipantsBtn client-tournament-manage__opsBarEqualBtn"
                      disabled={finalizeBusy}
                      onClick={() => void onFinalizeParticipants()}
                      style={{
                        ...opsBtn,
                        width: "100%",
                        borderColor: "#2563eb",
                        background: "#2563eb",
                        color: "#fff",
                        fontWeight: 800,
                      }}
                    >
                      {finalizeBusy ? "처리 중…" : "참가자 확정"}
                    </button>
                  ) : (
                    <span className="client-tournament-manage__opsBarPlaceholder" aria-hidden />
                  )}
                </div>
              </div>
              <div className="client-tournament-manage__applicationsOpsRow">
                <div className="client-tournament-manage__opsBarCell client-tournament-manage__opsBarCell--addSheet">
                  <ParticipantAddSheet
                    tournamentId={tournamentId}
                    maxParticipants={maxParticipants}
                    capacityOccupied={capacityOccupied}
                    participantsFinalized={tournamentStatusBadge === "마감"}
                    hasActiveBracket={hasActiveBracket}
                  />
                </div>
                <div className="client-tournament-manage__opsBarCell">
                  <button
                    type="button"
                    className="client-tournament-manage__opsBarEqualBtn"
                    disabled={bulkApproveBusy}
                    onClick={() => requestBulkDepositApprove()}
                    style={{
                      ...opsBtn,
                      width: "100%",
                      borderColor: "#15803d",
                      background: "#fff",
                      color: "#15803d",
                      fontWeight: 800,
                    }}
                  >
                    {bulkApproveBusy ? "처리 중…" : "입금확인 전체승인"}
                  </button>
                </div>
              </div>
            </div>
            <p className="client-tournament-manage__applicationsNotify client-tournament-manage__applicationsNotify--alert">
              승인완료시 신청자에게 신청완료 알림이 자동발신 됩니다.
            </p>
            <div className="client-tournament-manage__applicationsStatusLegendSingleLine" aria-label="신청 현황 및 표 버튼 안내">
              <div className="client-tournament-manage__applicationsStatusLegendSingleLine-chips">
                <span className="client-tournament-manage__statusChipCompact" style={{ ...pillBase, background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" }}>
                  신청 {participantCountSummary.total}명
                </span>
                <span className="client-tournament-manage__statusChipCompact" style={{ ...pillBase, background: "#ecfdf5", color: "#166534", borderColor: "#86efac" }}>
                  승인 {chipApproved}명
                </span>
                <span className="client-tournament-manage__statusChipCompact" style={{ ...pillBase, background: "#f9fafb", color: "#4b5563", borderColor: "#e5e7eb" }}>
                  취소 {participantCountSummary.reject}명
                </span>
                {waitingListTotal > 0 ? (
                  <span className="client-tournament-manage__statusChipCompact" style={{ ...pillBase, background: "#fffbeb", color: "#92400e", borderColor: "#fcd34d" }}>
                    대기자 {waitingListTotal}명
                  </span>
                ) : null}
              </div>
              <div className="client-tournament-manage__applicationsStatusLegendSingleLine-legend">
                <span className="client-tournament-manage__opLegendItem client-tournament-manage__opLegendItem--singleLine">
                  <span className="client-tournament-manage__opLegendDisk client-tournament-manage__opLegendDisk--won client-tournament-manage__opLegendDisk--singleLine" aria-hidden>
                    ₩
                  </span>
                  <span className="client-tournament-manage__opLegendCaption client-tournament-manage__opLegendCaption--singleLine">입금확인</span>
                </span>
                <span className="client-tournament-manage__opLegendItem client-tournament-manage__opLegendItem--singleLine">
                  <span className="client-tournament-manage__opLegendDisk client-tournament-manage__opLegendDisk--check client-tournament-manage__opLegendDisk--singleLine" aria-hidden>
                    ✓
                  </span>
                  <span className="client-tournament-manage__opLegendCaption client-tournament-manage__opLegendCaption--singleLine">승인</span>
                </span>
                <span className="client-tournament-manage__opLegendItem client-tournament-manage__opLegendItem--singleLine">
                  <span className="client-tournament-manage__opLegendDisk client-tournament-manage__opLegendDisk--cross client-tournament-manage__opLegendDisk--singleLine" aria-hidden>
                    ✕
                  </span>
                  <span className="client-tournament-manage__opLegendCaption client-tournament-manage__opLegendCaption--singleLine">취소</span>
                </span>
              </div>
            </div>
          </>
        )}

        {fullscreenTable && tableLandscapePhase !== "ready" ? (
          <p className="v3-muted" style={{ margin: 0, padding: "1rem 0.75rem", textAlign: "center", fontSize: "0.9rem", fontWeight: 700 }}>
            {tableLandscapePhase === "pending" ? "가로보기로 전환 중입니다." : "기기를 가로로 돌려주세요."}
          </p>
        ) : null}

        {zonesEnabled && (!fullscreenTable || tableLandscapePhase === "ready") ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.35rem",
              margin: fullscreenTable ? "0.2rem 0 0.15rem" : "0.14rem 0 0.2rem",
            }}
          >
            <span className="v3-muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              권역
            </span>
            <select
              value={zoneFilterZoneId}
              onChange={(e) => setZoneFilterZoneId(e.target.value)}
              disabled={activeZones.length === 0}
              aria-label="권역 필터"
              style={{
                ...opsBtn,
                minHeight: 30,
                padding: "0.16rem 0.36rem",
                fontSize: "0.8rem",
                maxWidth: "11rem",
                cursor: activeZones.length === 0 ? "not-allowed" : "pointer",
                opacity: activeZones.length === 0 ? 0.65 : 1,
              }}
            >
              <option value="all">전체</option>
              {activeZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {fullscreenTable && tableLandscapePhase === "ready" ? (
          <div className="client-tournament-manage__fullscreenTableBulkRow">
            <button
              type="button"
              disabled={bulkApproveBusy}
              onClick={() => requestBulkDepositApprove()}
              style={{
                ...opsBtn,
                borderColor: "#15803d",
                background: "#fff",
                color: "#15803d",
                fontWeight: 800,
                flex: "0 0 auto",
              }}
            >
              {bulkApproveBusy ? "처리 중…" : "입금확인 전체승인"}
            </button>
          </div>
        ) : null}
      </div>

      {!fullscreenTable || tableLandscapePhase === "ready" ? (
      <section
        className={
          fullscreenTable
            ? "client-tournament-manage__participantTableShell client-tournament-manage__participantTableShell--fullscreenScroll"
            : "client-tournament-manage__participantTableShell client-tournament-manage__participantTableShell--applicationsScroll"
        }
      >
        {zoneFilteredEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.65rem 0.75rem" }}>
            {participantCountSummary.total === 0
              ? "저장된 참가신청이 없습니다."
              : sortedEntries.length === 0
                ? "표시할 신청이 없습니다."
                : "선택한 권역에 배정된 신청이 없습니다."}
          </p>
        ) : (
          <div className="client-tournament-manage__applicationsTableInner client-dashboard-scroll-safe-area">
            <table
              className={`client-tournament-manage__participantTable client-tournament-manage__participantTable--singleLineMobile client-tournament-manage__participantTable--applicationsCompact ${fullscreenTable ? "client-tournament-manage__participantTable--fullscreenWide" : "client-tournament-manage__participantTable--appsStandardPortrait"}`}
              style={{
                width: "100%",
                minWidth: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: fullscreenTable ? "0.78rem" : "0.74rem",
              }}
            >
              {fullscreenTable ? (
                <colgroup className="client-tournament-manage__participantTableColgroup--fullscreen">
                  <col className="participant-col-w-fs participant-col-w-fs--apply" />
                  <col className="participant-col-w-fs participant-col-w-fs--name" />
                  <col className="participant-col-w-fs participant-col-w-fs--phone" />
                  <col className="participant-col-w-fs participant-col-w-fs--metric" />
                  <col className="participant-col-w-fs participant-col-w-fs--affiliation" />
                  <col className="participant-col-w-fs participant-col-w-fs--depositor" />
                  <col className="participant-col-w-fs participant-col-w-fs--approveInfo" />
                  <col className="participant-col-w-fs participant-col-w-fs--deposit" />
                  <col className="participant-col-w-fs participant-col-w-fs--approveBtn" />
                  <col className="participant-col-w-fs participant-col-w-fs--reject" />
                </colgroup>
              ) : (
                <colgroup className="client-tournament-manage__participantTableColgroup--appsStandard">
                  <col className="participant-col-w-std participant-col-w-std--apply" />
                  <col className="participant-col-w-std participant-col-w-std--name" />
                  <col className="participant-col-w-std participant-col-w-std--depositor" />
                  <col className="participant-col-w-std participant-col-w-std--approveInfo" />
                  <col className="participant-col-w-std participant-col-w-std--deposit" />
                  <col className="participant-col-w-std participant-col-w-std--approveBtn" />
                  <col className="participant-col-w-std participant-col-w-std--reject" />
                </colgroup>
              )}
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {fullscreenTable ? (
                    <>
                      <th className="participant-th participant-th--apply" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        신청
                      </th>
                      <th className="participant-th participant-th--name" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        이름
                      </th>
                      <th className="participant-th participant-th--phoneFs" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        전화번호
                      </th>
                      <th className="participant-th participant-th--metric" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        {metricColumnTitle}
                      </th>
                      <th className="participant-th participant-th--affiliationFs" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        소속
                      </th>
                      <th className="participant-th participant-th--depositor" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        입금자
                      </th>
                      <th className="participant-th participant-th--approveInfoFs" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        승인
                      </th>
                      <th className="participant-th participant-th--deposit" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        입금
                      </th>
                      <th className="participant-th participant-th--approveBtn" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        승인
                      </th>
                      <th className="participant-th participant-th--reject" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        취소
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="participant-th participant-th--apply" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        신청
                      </th>
                      <th className="participant-th participant-th--name" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        이름
                      </th>
                      <th className="participant-th participant-th--depositor" style={{ ...participantApplicationsTableThBase, textAlign: "left" }}>
                        입금자
                      </th>
                      <th className="participant-th participant-th--approveInfo" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        승인
                      </th>
                      <th className="participant-th participant-th--deposit" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        입금
                      </th>
                      <th className="participant-th participant-th--approveBtn" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        승인
                      </th>
                      <th className="participant-th participant-th--reject" style={{ ...participantApplicationsTableThBase, textAlign: "center" }}>
                        취소
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {zoneFilteredEntries.map((entry) => (
                  <ParticipantListRow
                    key={entry.id}
                    tournamentId={tournamentId}
                    entryId={entry.id}
                    applicantName={entry.applicantName}
                    depositorName={entry.depositorName ?? null}
                    affiliation={entry.affiliation ?? null}
                    initialStatus={entry.status}
                    phone={entry.phone}
                    registrationCreatedAt={entry.createdAt}
                    registrationSource={entry.registrationSource ?? null}
                    participantAverage={entry.participantAverage ?? null}
                    metricColumnTitle={metricColumnTitle}
                    adminNote={entry.adminNote ?? null}
                    statusChangedAt={entry.statusChangedAt}
                    attendanceChecked={entry.attendanceChecked}
                    initialClientDepositConfirmedAt={entry.clientDepositConfirmedAt ?? null}
                    initialClientApplicationApprovedAt={entry.clientApplicationApprovedAt ?? null}
                    rowLayout={rowLayout}
                    opButtonPresentation={fullscreenTable ? "text" : "icon"}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {finalizeUnapprovedModalCount !== null ? (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 240,
              background: "rgba(15,23,42,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "max(1rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px)) max(1rem, env(safe-area-inset-bottom, 0px)) max(1rem, env(safe-area-inset-left, 0px))",
              boxSizing: "border-box",
            }}
            onMouseDown={(ev) => {
              if (ev.target === ev.currentTarget) setFinalizeUnapprovedModalCount(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="참가 확정 확인"
              className="v3-box v3-stack"
              style={{
                maxWidth: "22rem",
                width: "100%",
                background: "#fff",
                borderRadius: "0.65rem",
                padding: "1rem",
                gap: "0.65rem",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.45 }}>
                미승인자가 {finalizeUnapprovedModalCount}명 있습니다. 그래도 참가자를 확정하시겠습니까?
              </p>
              <div className="v3-row" style={{ justifyContent: "flex-end", gap: "0.45rem" }}>
                <button type="button" className="v3-btn" onClick={() => setFinalizeUnapprovedModalCount(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  style={{ fontWeight: 800 }}
                  onClick={() => {
                    setFinalizeUnapprovedModalCount(null);
                    setFinalizeBusy(true);
                    void (async () => {
                      try {
                        await runFinalizeParticipantsCore();
                      } catch {
                        window.alert("처리 중 오류가 발생했습니다.");
                      } finally {
                        setFinalizeBusy(false);
                      }
                    })();
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {bulkDepositApproveModalOpen ? (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 241,
              background: "rgba(15,23,42,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "max(1rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px)) max(1rem, env(safe-area-inset-bottom, 0px)) max(1rem, env(safe-area-inset-left, 0px))",
              boxSizing: "border-box",
            }}
            onMouseDown={(ev) => {
              if (ev.target === ev.currentTarget) cancelBulkDepositApproveModal();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="입금확인 전체 승인 확인"
              className="v3-box v3-stack"
              style={{
                maxWidth: "22rem",
                width: "100%",
                background: "#fff",
                borderRadius: "0.65rem",
                padding: "1rem",
                gap: "0.65rem",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.45 }}>입금확인 된 미승인자를 전체 승인합니다.</p>
              <div className="v3-row" style={{ justifyContent: "flex-end", gap: "0.45rem" }}>
                <button type="button" className="v3-btn" onClick={() => cancelBulkDepositApproveModal()}>
                  취소
                </button>
                <button type="button" className="v3-btn" style={{ fontWeight: 800 }} onClick={() => void executeBulkDepositApproveAfterConfirm()}>
                  확인
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {moreLoading ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.45rem 0.5rem", fontSize: "0.8rem", textAlign: "center" }}>
            불러오는 중…
          </p>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
