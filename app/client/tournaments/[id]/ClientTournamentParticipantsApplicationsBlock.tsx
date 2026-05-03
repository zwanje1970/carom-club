"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TournamentApplicationListItem } from "../../../../lib/types/entities";
import { filterParticipantEntries, type ClientParticipantFilterKey } from "./client-participant-filter-shared";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantsToolbar from "./participants/ParticipantsToolbar";

export type ParticipantCountSummary = {
  total: number;
  approved: number;
  wait: number;
  reject: number;
};

type Props = {
  tournamentId: string;
  initialEntries: TournamentApplicationListItem[];
  participantCountSummary: ParticipantCountSummary;
  selected: ClientParticipantFilterKey;
  filterBaseHref: string;
};

function filterLinkStyle(selected: ClientParticipantFilterKey, key: ClientParticipantFilterKey) {
  const on = selected === key;
  return {
    padding: "0.45rem 0.65rem",
    fontWeight: on ? 800 : 600,
    fontSize: "0.88rem",
    background: on ? "#dbeafe" : "#fff",
    borderColor: on ? "#2563eb" : "#d7d7d7",
    color: on ? "#1e3a8a" : "#374151",
    boxShadow: on ? "0 0 0 1px #2563eb33" : "none",
    textDecoration: "none" as const,
    borderRadius: "0.35rem",
    touchAction: "manipulation" as const,
  };
}

function groupDraftStorageKey(tournamentId: string): string {
  return `v3-participant-group-draft:${tournamentId.trim()}`;
}

function loadGroupDraftMap(tournamentId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(groupDraftStorageKey(tournamentId));
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (typeof v === "number") out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
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

export default function ClientTournamentParticipantsApplicationsBlock({
  tournamentId,
  initialEntries,
  participantCountSummary,
  selected,
  filterBaseHref,
}: Props) {
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
    () => [...filteredEntries].sort((a, b) => a.applicantName.localeCompare(b.applicantName, "ko")),
    [filteredEntries]
  );

  const [groupByEntryId, setGroupByEntryId] = useState<Record<string, string>>({});
  useEffect(() => {
    setGroupByEntryId(loadGroupDraftMap(tournamentId));
  }, [tournamentId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(groupDraftStorageKey(tournamentId), JSON.stringify(groupByEntryId));
    } catch {
      /* ignore quota */
    }
  }, [groupByEntryId, tournamentId]);

  const onGroupDraftChange = useCallback((entryId: string, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 3);
    setGroupByEntryId((prev) => ({ ...prev, [entryId]: v }));
  }, []);

  const counts = participantCountSummary;
  const base = filterBaseHref.replace(/\/$/, "");

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 25,
          background: "#fff",
          paddingBottom: "0.45rem",
          marginBottom: "0.35rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <ParticipantsToolbar tournamentId={tournamentId} />
        <div
          className="v3-row"
          style={{ flexWrap: "wrap", gap: "0.3rem", alignItems: "center", marginTop: "0.35rem" }}
        >
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
      </div>

      <section
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: "0.4rem",
          overflow: "hidden",
        }}
      >
        {sortedEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "1rem" }}>
            {participantCountSummary.total === 0 ? "저장된 참가신청이 없습니다." : "이 조건에 해당하는 참가자가 없습니다."}
          </p>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table
              style={{
                width: "100%",
                minWidth: "36rem",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "left",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    이름
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      width: "4.5rem",
                    }}
                  >
                    점수/에버
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "left",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      width: "7.5rem",
                    }}
                  >
                    전화번호
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      width: "3.5rem",
                    }}
                  >
                    입금일
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      width: "3.75rem",
                    }}
                  >
                    조
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.35rem",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      width: "3rem",
                    }}
                  >
                    출석
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <ParticipantListRow
                    key={entry.id}
                    tournamentId={tournamentId}
                    entryId={entry.id}
                    applicantName={entry.applicantName}
                    initialStatus={entry.status}
                    phone={entry.phone}
                    createdShort={new Date(entry.createdAt).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    registrationSource={entry.registrationSource ?? null}
                    participantAverage={entry.participantAverage ?? null}
                    adminNote={entry.adminNote ?? null}
                    statusChangedAt={entry.statusChangedAt}
                    attendanceChecked={entry.attendanceChecked}
                    groupDraft={groupByEntryId[entry.id] ?? ""}
                    onGroupDraftChange={onGroupDraftChange}
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
    </>
  );
}
