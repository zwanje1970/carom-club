"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TournamentApplicationListItem, TournamentStatusBadge } from "../../../../lib/types/entities";
import type { TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";
import { useApplicationsTableMobileLayout } from "../../../../lib/client/use-applications-table-mobile-layout";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantAddSheet from "./participants/ParticipantAddSheet";
import ApplicationsTableOrientationLock from "./participants/ApplicationsTableOrientationLock";

export type ParticipantCountSummary = {
  total: number;
  approved: number;
  wait: number;
  reject: number;
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

function countApplicationApprovedChip(entries: TournamentApplicationListItem[]): number {
  return entries.filter(
    (e) =>
      e.status === "APPROVED" ||
      (typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "")
  ).length;
}

/** 입금확인만 된 상태 · 신청 승인(clientApplicationApprovedAt) 전 · 취소·참가확정 제외 */
function listItemEligibleBulkDepositApprove(e: TournamentApplicationListItem): boolean {
  if (e.status === "REJECTED" || e.status === "APPROVED") return false;
  const hasDep = typeof e.clientDepositConfirmedAt === "string" && e.clientDepositConfirmedAt.trim() !== "";
  if (!hasDep) return false;
  const hasAppr = typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "";
  return !hasAppr;
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
  variant = "standard",
}: Props) {
  const router = useRouter();
  const isApplicationsMobileLayout = useApplicationsTableMobileLayout();
  const metricColumnTitle = participantMetricColumnTitle(entryQualificationType);
  const [entries, setEntries] = useState<TournamentApplicationListItem[]>(initialEntries);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [bulkApproveBusy, setBulkApproveBusy] = useState(false);
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
  const fullscreenTable = variant === "fullscreenTable";
  const rowLayout = fullscreenTable ? "fullscreen" : "standard";

  async function onBulkApproveDepositConfirmed() {
    if (bulkApproveBusy) return;
    const targets = zoneFilteredEntries.filter(listItemEligibleBulkDepositApprove);
    if (targets.length === 0) {
      window.alert("입금확인만 되어 있고 아직 신청 승인 전인 건이 없습니다.");
      return;
    }
    if (
      !window.confirm(
        `입금확인된 ${targets.length}건을 일괄 신청 승인할까요?\n(이미 승인·참가확정·거절 건은 제외됩니다. 개별 승인과 동일 API를 사용합니다.)`
      )
    ) {
      return;
    }
    setBulkApproveBusy(true);
    try {
      for (const t of targets) {
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

  async function onFinalizeParticipants() {
    if (finalizeBusy) return;
    if (
      !window.confirm(
        "참가자를 확정하시겠습니까?\n확정 후에는 신청이 마감되며 대진표 생성이 활성화됩니다."
      )
    ) {
      return;
    }
    setFinalizeBusy(true);
    try {
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
      {fullscreenTable && isApplicationsMobileLayout ? <ApplicationsTableOrientationLock /> : null}
      <div className="client-tournament-manage__applicationsHeaderZone">
        {fullscreenTable ? (
          <div className="client-tournament-manage__fullscreenTableHead">
            <Link
              prefetch={false}
              href={`/client/tournaments/${encodeURIComponent(tournamentId)}/participants`}
              className="client-tournament-manage__fullscreenTableClose"
              style={{ ...opsBtn, flex: "0 0 auto", textDecoration: "none", fontWeight: 700 }}
            >
              ← 닫기
            </Link>
            <p className="client-tournament-manage__fullscreenTableTitle">{titleLine}</p>
          </div>
        ) : (
          <p className="client-tournament-manage__applicationsTitle">{titleLine}</p>
        )}

        {!fullscreenTable ? (
          <div className="client-tournament-manage__applicationsOpsBar">
            <ParticipantAddSheet tournamentId={tournamentId} />
            {showFinalize ? (
              <button
                type="button"
                className="client-tournament-manage__finalizeParticipantsBtn"
                disabled={finalizeBusy}
                onClick={() => void onFinalizeParticipants()}
                style={{
                  ...opsBtn,
                  borderColor: "#2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                {finalizeBusy ? "처리 중…" : "참가자 확정"}
              </button>
            ) : null}
            <Link prefetch={false} href={printHref} style={{ ...opsBtn, textDecoration: "none" }}>
              확정리스트
            </Link>
            <Link prefetch={false} href={tableViewHref} style={{ ...opsBtn, textDecoration: "none" }}>
              가로보기
            </Link>
            <button
              type="button"
              disabled={bulkApproveBusy}
              onClick={() => void onBulkApproveDepositConfirmed()}
              style={{
                ...opsBtn,
                borderColor: "#15803d",
                background: "#fff",
                color: "#15803d",
                fontWeight: 800,
              }}
            >
              {bulkApproveBusy ? "처리 중…" : "입금확인 전체승인"}
            </button>
          </div>
        ) : null}

        {zonesEnabled ? (
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

        {!fullscreenTable ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.22rem",
              margin: zonesEnabled ? "0 0 0.26rem" : "0.04rem 0 0.26rem",
            }}
          >
            <span style={{ ...pillBase, background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" }}>
              총신청 {participantCountSummary.total}명
            </span>
            <span style={{ ...pillBase, background: "#ecfdf5", color: "#166534", borderColor: "#86efac" }}>
              승인 {chipApproved}명
            </span>
            <span style={{ ...pillBase, background: "#f9fafb", color: "#4b5563", borderColor: "#e5e7eb" }}>
              취소/거절 {participantCountSummary.reject}명
            </span>
          </div>
        ) : (
          <>
            <p className="v3-muted client-tournament-manage__fullscreenTableMeta">
              총 {participantCountSummary.total}명 · 승인 {chipApproved}명 · 취소/거절 {participantCountSummary.reject}명
            </p>
            <div className="client-tournament-manage__fullscreenTableBulkRow">
              <button
                type="button"
                disabled={bulkApproveBusy}
                onClick={() => void onBulkApproveDepositConfirmed()}
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
          </>
        )}

        {!fullscreenTable ? (
          <p className="client-tournament-manage__applicationsNotify">
            승인완료시 신청자에게 신청완료 알림이 발송됩니다.
          </p>
        ) : null}
      </div>

      <section
        className={
          fullscreenTable
            ? "client-tournament-manage__participantTableShell client-tournament-manage__participantTableShell--fullscreenScroll"
            : "client-tournament-manage__participantTableShell client-tournament-manage__participantTableShell--applicationsScroll"
        }
      >
        <p className="client-tournament-manage__applicationsSymbolLegend">
          <span className="client-tournament-manage__applicationsSymbolLegendItem">₩ = 입금확인</span>
          <span className="client-tournament-manage__applicationsSymbolLegendItem">✓ = 승인</span>
          <span className="client-tournament-manage__applicationsSymbolLegendItem">✕ = 취소/거절</span>
        </p>
        {zoneFilteredEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.65rem 0.75rem" }}>
            {participantCountSummary.total === 0
              ? "저장된 참가신청이 없습니다."
              : sortedEntries.length === 0
                ? "표시할 신청이 없습니다."
                : "선택한 권역에 배정된 신청이 없습니다."}
          </p>
        ) : (
          <div className="client-tournament-manage__applicationsTableInner">
            <table
              className={`client-tournament-manage__participantTable client-tournament-manage__participantTable--singleLineMobile client-tournament-manage__participantTable--applicationsCompact ${fullscreenTable ? "client-tournament-manage__participantTable--fullscreenWide" : ""}`}
              style={{
                width: "100%",
                minWidth: fullscreenTable ? "720px" : "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: fullscreenTable ? "0.8rem" : "0.74rem",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {fullscreenTable ? (
                    <>
                      <th
                        className="participant-th participant-th--apply"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "6%", minWidth: "2.75rem" }}
                      >
                        신청
                      </th>
                      <th
                        className="participant-th participant-th--name"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "10%", minWidth: "3.5rem" }}
                      >
                        이름
                      </th>
                      <th
                        className="participant-th participant-th--phoneFs"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "16%", minWidth: "7.25rem" }}
                      >
                        전화번호
                      </th>
                      <th
                        className="participant-th participant-th--metric"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "6%", minWidth: "2.25rem" }}
                      >
                        {metricColumnTitle}
                      </th>
                      <th
                        className="participant-th participant-th--affiliationFs"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "10%", minWidth: "3rem" }}
                      >
                        소속
                      </th>
                      <th
                        className="participant-th participant-th--depositor"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "10%", minWidth: "3rem" }}
                      >
                        입금자
                      </th>
                      <th
                        className="participant-th participant-th--approveInfoFs"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "9%", minWidth: "2.75rem" }}
                      >
                        승인
                      </th>
                      <th
                        className="participant-th participant-th--deposit"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "7%", minWidth: "2.5rem" }}
                      >
                        입금확인
                      </th>
                      <th
                        className="participant-th participant-th--approveBtn"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "7%", minWidth: "2.5rem" }}
                      >
                        승인
                      </th>
                      <th
                        className="participant-th participant-th--reject"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "7%", minWidth: "2.5rem" }}
                      >
                        취소
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        className="participant-th participant-th--apply"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "10%", minWidth: "2.85rem" }}
                      >
                        신청
                      </th>
                      <th
                        className="participant-th participant-th--name"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "22%", minWidth: "4.5rem" }}
                      >
                        이름
                      </th>
                      <th
                        className="participant-th participant-th--metric"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "9%", minWidth: "2.2rem" }}
                      >
                        {metricColumnTitle}
                      </th>
                      <th
                        className="participant-th participant-th--depositor"
                        style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "18%", minWidth: "3.5rem" }}
                      >
                        입금자
                      </th>
                      <th
                        className="participant-th participant-th--approveInfo"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "14%", minWidth: "3rem" }}
                      >
                        승인
                      </th>
                      <th
                        className="participant-th participant-th--deposit"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "9%", minWidth: "2.4rem" }}
                      >
                        ₩
                      </th>
                      <th
                        className="participant-th participant-th--approveBtn"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "9%", minWidth: "2.4rem" }}
                      >
                        ✓
                      </th>
                      <th
                        className="participant-th participant-th--reject"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "9%", minWidth: "2.4rem" }}
                      >
                        ✕
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {moreLoading ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.45rem 0.5rem", fontSize: "0.8rem", textAlign: "center" }}>
            불러오는 중…
          </p>
        ) : null}
      </section>
    </div>
  );
}
