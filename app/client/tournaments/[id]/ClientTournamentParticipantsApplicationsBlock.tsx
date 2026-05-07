"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TournamentApplicationListItem, TournamentStatusBadge } from "../../../../lib/types/entities";
import type { TournamentEntryQualificationType } from "../../../../lib/tournament-rule-types";
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
};

const participantApplicationsTableThBase: CSSProperties = {
  padding: "0.1rem 0.12rem",
  fontSize: "0.66rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  verticalAlign: "middle",
};

const opsBtn: CSSProperties = {
  minHeight: 30,
  padding: "0.16rem 0.34rem",
  fontSize: "0.7rem",
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
  fontSize: "0.62rem",
  fontWeight: 700,
  padding: "0.08rem 0.28rem",
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
}: Props) {
  const router = useRouter();
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
  const showFinalize = !CLOSED_BADGES.includes(tournamentStatusBadge);

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

  return (
    <div className="client-tournament-manage__participantsBlock client-tournament-manage__applicationsCompactHeader">
      <p
        style={{
          margin: "0 0 0.18rem",
          fontSize: "0.88rem",
          fontWeight: 800,
          lineHeight: 1.25,
          color: "#0f172a",
        }}
      >
        {tournamentTitle.trim()} / {bracketScaleLabel(maxParticipants)}
      </p>

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
      </div>

      {zonesEnabled ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.35rem",
            margin: "0.14rem 0 0.2rem",
          }}
        >
          <span className="v3-muted" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
            권역
          </span>
          <select
            value={zoneFilterZoneId}
            onChange={(e) => setZoneFilterZoneId(e.target.value)}
            disabled={activeZones.length === 0}
            aria-label="권역 필터"
            style={{
              ...opsBtn,
              minHeight: 28,
              padding: "0.14rem 0.34rem",
              fontSize: "0.68rem",
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

      <section className="client-tournament-manage__participantTableShell">
        {zoneFilteredEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.65rem 0.75rem" }}>
            {participantCountSummary.total === 0
              ? "저장된 참가신청이 없습니다."
              : sortedEntries.length === 0
                ? "표시할 신청이 없습니다."
                : "선택한 권역에 배정된 신청이 없습니다."}
          </p>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              className="client-tournament-manage__participantTable client-tournament-manage__participantTable--singleLineMobile client-tournament-manage__participantTable--applicationsCompact"
              style={{
                width: "100%",
                minWidth: "26rem",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                fontSize: "0.72rem",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "2.6rem" }}>신청일</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "14%", minWidth: "3.2rem" }}>
                    이름
                  </th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "3.6rem" }}>{metricColumnTitle}</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "14%", minWidth: "3.2rem" }}>
                    입금자 이름
                  </th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "4.25rem" }}>입금확인</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "4rem" }}>승인</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "2.5rem" }}>승인일</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "4.25rem" }}>취소/거절</th>
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
