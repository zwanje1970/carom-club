"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TournamentApplicationListItem, TournamentStatusBadge } from "../../../../lib/types/entities";
import { filterParticipantEntries, type ClientParticipantFilterKey } from "./client-participant-filter-shared";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantsToolbar from "./participants/ParticipantsToolbar";
import TournamentParticipantsFinalizeBar from "./TournamentParticipantsFinalizeBar";

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

type Props = {
  tournamentId: string;
  tournamentTitle: string;
  maxParticipants: number;
  initialEntries: TournamentApplicationListItem[];
  participantCountSummary: ParticipantCountSummary;
  selected: ClientParticipantFilterKey;
  filterBaseHref: string;
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

function filterLinkStyle(selected: ClientParticipantFilterKey, key: ClientParticipantFilterKey) {
  const on = selected === key;
  return {
    padding: "0.3rem 0.5rem",
    minHeight: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: on ? 800 : 600,
    fontSize: "0.84rem",
    background: on ? "#dbeafe" : "#fff",
    borderColor: on ? "#2563eb" : "#d7d7d7",
    color: on ? "#1e3a8a" : "#374151",
    boxShadow: on ? "0 0 0 1px #2563eb33" : "none",
    textDecoration: "none" as const,
    borderRadius: "0.35rem",
    touchAction: "manipulation" as const,
  };
}

function capacityLabel(maxParticipants: number): string {
  const n = Number(maxParticipants);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return String(Math.floor(n));
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

function countCanceledRejectedChip(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => e.status === "REJECTED").length;
}

export default function ClientTournamentParticipantsApplicationsBlock({
  tournamentId,
  tournamentTitle,
  maxParticipants,
  initialEntries,
  participantCountSummary,
  selected,
  filterBaseHref,
  zonesEnabled,
  tournamentStatusBadge,
}: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<TournamentApplicationListItem[]>(initialEntries);
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

  const filteredEntries = filterParticipantEntries(entries, selected);
  const sortedEntries = useMemo(
    () => [...filteredEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [filteredEntries]
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

  const chipTotal = entries.length;
  const chipApproved = countApplicationApprovedChip(entries);
  const chipCancelReject = countCanceledRejectedChip(entries);

  const counts = participantCountSummary;
  const base = filterBaseHref.replace(/\/$/, "");

  return (
    <div className="client-tournament-manage__participantsBlock">
      <TournamentParticipantsFinalizeBar
        tournamentId={tournamentId}
        tournamentStatusBadge={tournamentStatusBadge}
        approvedCount={participantCountSummary.approved}
      />
      <div className="client-tournament-manage__participantsSticky">
        <ParticipantsToolbar tournamentId={tournamentId} />
        <div className="client-tournament-manage__filterRow">
          <Link className="v3-btn" href={base} prefetch={false} style={filterLinkStyle(selected, "all")}>
            전체 ({counts.total})
          </Link>
          <Link className="v3-btn" href={`${base}?f=approved`} prefetch={false} style={filterLinkStyle(selected, "approved")}>
            참가자 ({counts.approved})
          </Link>
          <Link className="v3-btn" href={`${base}?f=wait`} prefetch={false} style={filterLinkStyle(selected, "wait")}>
            신청자 ({counts.wait})
          </Link>
          <Link className="v3-btn" href={`${base}?f=reject`} prefetch={false} style={filterLinkStyle(selected, "reject")}>
            거절 ({counts.reject})
          </Link>
        </div>
        {zonesEnabled ? (
          <div className="client-tournament-manage__filterRow" style={{ marginTop: "0.35rem" }}>
            <label className="v3-muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 700 }}>
              권역
              <select
                className="v3-btn"
                value={zoneFilterZoneId}
                onChange={(e) => setZoneFilterZoneId(e.target.value)}
                disabled={activeZones.length === 0}
                style={{
                  minHeight: 38,
                  padding: "0.25rem 0.45rem",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  borderRadius: "0.35rem",
                  border: "1px solid #d7d7d7",
                  background: activeZones.length === 0 ? "#f1f5f9" : "#fff",
                  color: "#374151",
                  maxWidth: "12rem",
                }}
              >
                <option value="all">전체</option>
                {activeZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zoneName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div
        style={{
          margin: "0.35rem 0 0",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.35rem 0.5rem",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", minWidth: 0 }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 800, lineHeight: 1.35 }}>신청자 관리</span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "0.12rem 0.38rem",
              borderRadius: "0.35rem",
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #e2e8f0",
            }}
          >
            총 신청 {chipTotal}명
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "0.12rem 0.38rem",
              borderRadius: "0.35rem",
              background: "#dcfce7",
              color: "#14532d",
              border: "1px solid #86efac",
            }}
          >
            승인 {chipApproved}명
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              padding: "0.12rem 0.38rem",
              borderRadius: "0.35rem",
              background: "#f3f4f6",
              color: "#4b5563",
              border: "1px solid #d1d5db",
            }}
          >
            취소/거절 {chipCancelReject}명
          </span>
        </div>
        <button
          type="button"
          className="v3-btn"
          onClick={() => router.refresh()}
          style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.25rem 0.55rem", minHeight: 34 }}
        >
          새로고침
        </button>
      </div>
      <p style={{ margin: "0.12rem 0 0.35rem", fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>
        {tournamentTitle.trim()} · 표시 {zoneFilteredEntries.length}명 / 정원 {capacityLabel(maxParticipants)}
      </p>

      <section className="client-tournament-manage__participantTableShell">
        {zoneFilteredEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "0.65rem 0.75rem" }}>
            {participantCountSummary.total === 0
              ? "저장된 참가신청이 없습니다."
              : sortedEntries.length === 0
                ? "이 조건에 해당하는 참가자가 없습니다."
                : "선택한 권역에 배정된 참가자가 없습니다."}
          </p>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              className="client-tournament-manage__participantTable client-tournament-manage__participantTable--singleLineMobile client-tournament-manage__participantTable--applicationsCompact"
              style={{
                width: "100%",
                minWidth: "28rem",
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
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "center", width: "4.2rem" }}>점수/AVG</th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "12%", minWidth: "3rem" }}>
                    입금자 이름
                  </th>
                  <th style={{ ...participantApplicationsTableThBase, textAlign: "left", width: "11%", minWidth: "2.8rem" }}>
                    소속
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
