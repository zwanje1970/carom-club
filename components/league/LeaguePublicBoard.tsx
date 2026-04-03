"use client";

import { useMemo, useState } from "react";
import type { LeagueDetailView } from "@/lib/league-view";
import { LeagueKindLabel, LeagueMatchesTable, LeagueStandingsTable, LeagueStatusBadge } from "./LeagueTables";

type TabId = "matches" | "standings";

export function LeaguePublicBoard({
  tournamentName,
  leagues,
  myTournamentEntryIds,
}: {
  tournamentName: string;
  leagues: LeagueDetailView[];
  myTournamentEntryIds: string[];
}) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id ?? "");
  const [tab, setTab] = useState<TabId>("matches");

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0] ?? null,
    [leagues, selectedLeagueId]
  );

  if (!selectedLeague) {
    return <p className="rounded-xl border border-site-border bg-site-card p-6 text-center text-gray-500">아직 리그가 생성되지 않았습니다.</p>;
  }

  const entriesById = Object.fromEntries(selectedLeague.entries.map((entry) => [entry.id, entry.displayName]));
  const myLeagueEntries = selectedLeague.entries.filter((entry) => myTournamentEntryIds.includes(entry.tournamentEntryId));
  const remainingOpponents = myLeagueEntries.map((entry) => {
    const playedOpponentIds = new Set(
      selectedLeague.matches
        .filter(
          (match) =>
            match.status === "COMPLETED" &&
            (match.leagueEntryIdA === entry.id || match.leagueEntryIdB === entry.id)
        )
        .map((match) => (match.leagueEntryIdA === entry.id ? match.leagueEntryIdB : match.leagueEntryIdA))
        .filter((id): id is string => Boolean(id))
    );

    const pendingOpponents = selectedLeague.entries.filter(
      (opponent) =>
        opponent.id !== entry.id &&
        opponent.status === "ACTIVE" &&
        !playedOpponentIds.has(opponent.id)
    );
    const activeOpponentCount = selectedLeague.entries.filter((opponent) => opponent.id !== entry.id && opponent.status === "ACTIVE").length;

    return {
      entry,
      pendingOpponents,
      playedCount: activeOpponentCount - pendingOpponents.length,
    };
  });

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-site-border bg-site-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-gray-500">공개 리그전</p>
            <h1 className="text-2xl font-bold text-site-text">{tournamentName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => setSelectedLeagueId(league.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  league.id === selectedLeague.id
                    ? "border-site-primary bg-site-primary/10 text-site-primary"
                    : "border-site-border text-gray-600 hover:bg-site-bg"
                }`}
              >
                {LeagueKindLabel(league.kind)} {league.zoneId ? "· 권역" : ""}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="상태" value={<LeagueStatusBadge status={selectedLeague.status} />} />
        <SummaryCard label="참가자" value={String(selectedLeague.entries.length)} />
        <SummaryCard label="경기" value={String(selectedLeague.matches.length)} />
        <SummaryCard label="순위" value={String(selectedLeague.standings.length)} />
      </section>

      <nav className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("matches")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            tab === "matches"
              ? "bg-site-primary text-white"
              : "border border-site-border text-gray-600 hover:bg-site-bg"
          }`}
        >
          경기표
        </button>
        <button
          type="button"
          onClick={() => setTab("standings")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            tab === "standings"
              ? "bg-site-primary text-white"
              : "border border-site-border text-gray-600 hover:bg-site-bg"
          }`}
        >
          순위표
        </button>
      </nav>

      {myLeagueEntries.length > 0 && (
        <section className="space-y-3 rounded-xl border border-site-border bg-site-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-site-text">내 경기 기록</h2>
              <p className="text-sm text-gray-500">아직 만나지 않은 상대를 확인할 수 있습니다.</p>
            </div>
            <span className="text-sm text-gray-500">{myLeagueEntries.length}개 엔트리</span>
          </div>

          <div className="space-y-3">
            {remainingOpponents.map(({ entry, pendingOpponents, playedCount }) => (
              <article key={entry.id} className="rounded-lg border border-site-border bg-site-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-site-text">{entry.displayName}</div>
                    <div className="text-xs text-gray-500">
                      {entry.levelCode ?? "-"} · {entry.status === "ACTIVE" ? "활성" : entry.status === "WITHDRAWN" ? "제외" : "자동 제외"}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    진행 {playedCount} / 남은 {pendingOpponents.length}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {pendingOpponents.length > 0 ? (
                    pendingOpponents.map((opponent) => (
                      <span
                        key={opponent.id}
                        className="rounded-full border border-site-border bg-site-card px-3 py-1 text-sm text-gray-700"
                      >
                        {opponent.displayName}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-emerald-700">남은 상대가 없습니다.</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "matches" ? (
        <LeagueMatchesTable rounds={selectedLeague.rounds} entriesById={entriesById} />
      ) : (
        <LeagueStandingsTable standings={selectedLeague.standings} />
      )}

    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-site-border bg-site-bg p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-site-text">{value}</div>
    </div>
  );
}
