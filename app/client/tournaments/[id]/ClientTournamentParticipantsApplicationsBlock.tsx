"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TournamentApplicationListItem, TournamentStatusBadge } from "../../../../lib/types/entities";
import type { TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";
import { useApplicationsTableMobileLayout } from "../../../../lib/client/use-applications-table-mobile-layout";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantAddSheet from "./participants/ParticipantAddSheet";

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
  const applicationsMobileMerged = variant === "standard" && useApplicationsTableMobileLayout();
  const metricColumnTitle = participantMetricColumnTitle(entryQualificationType);
  const [entries, setEntries] = useState<TournamentApplicationListItem[]>(initialEntries);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
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

  /*
   * 향후 확장(미구현): 입금확인 ON · 신청 승인 OFF · 취소/거절 아님 인원만 일괄 승인.
   * 이미 승인된 신청은 제외·푸시 재발송 없음 — Firestore 필드(clientDepositConfirmedAt / clientApplicationApprovedAt / status) 조합으로 필터링 가능.
   */

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
          <p className="v3-muted client-tournament-manage__fullscreenTableMeta">
            총 {participantCountSummary.total}명 · 승인 {chipApproved}명 · 취소/거절 {participantCountSummary.reject}명
          </p>
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
                fontSize: fullscreenTable ? "0.82rem" : applicationsMobileMerged ? "0.78rem" : "0.74rem",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th
                    className="participant-th participant-th--apply"
                    style={{ ...participantApplicationsTableThBase, textAlign: "center", width: applicationsMobileMerged ? "9%" : "5.5%", minWidth: "2.75rem" }}
                  >
                    신청
                  </th>
                  <th
                    className="participant-th participant-th--name"
                    style={{
                      ...participantApplicationsTableThBase,
                      textAlign: "left",
                      width: applicationsMobileMerged ? "30%" : "26%",
                      minWidth: applicationsMobileMerged ? "7rem" : "5.5rem",
                    }}
                  >
                    이름
                  </th>
                  <th
                    className="participant-th participant-th--metric"
                    style={{
                      ...participantApplicationsTableThBase,
                      textAlign: "center",
                      width: applicationsMobileMerged ? "8%" : "7%",
                      minWidth: "2.35rem",
                    }}
                  >
                    {metricColumnTitle}
                  </th>
                  <th
                    className="participant-th participant-th--depositor"
                    style={{
                      ...participantApplicationsTableThBase,
                      textAlign: "left",
                      width: applicationsMobileMerged ? "auto" : "22%",
                      minWidth: applicationsMobileMerged ? "5rem" : "4.5rem",
                    }}
                  >
                    입금자 이름
                  </th>
                  {applicationsMobileMerged ? (
                    <th
                      className="participant-th participant-th--processing"
                      style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "22%", minWidth: "9.5rem" }}
                    >
                      처리
                    </th>
                  ) : (
                    <>
                      <th
                        className="participant-th participant-th--deposit"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "11%", minWidth: "3.75rem" }}
                      >
                        입금확인
                      </th>
                      <th
                        className="participant-th participant-th--approveBtn"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "11%", minWidth: "3.75rem" }}
                      >
                        처리
                      </th>
                      <th
                        className="participant-th participant-th--approveDate"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "6.5%", minWidth: "1.85rem" }}
                      >
                        승인
                      </th>
                      <th
                        className="participant-th participant-th--reject"
                        style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "11%", minWidth: "3.75rem" }}
                      >
                        취소/거절
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
                    approveActionColumnLabel="처리"
                    adminNote={entry.adminNote ?? null}
                    statusChangedAt={entry.statusChangedAt}
                    attendanceChecked={entry.attendanceChecked}
                    initialClientDepositConfirmedAt={entry.clientDepositConfirmedAt ?? null}
                    initialClientApplicationApprovedAt={entry.clientApplicationApprovedAt ?? null}
                    applicationsMobileMerged={applicationsMobileMerged}
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
