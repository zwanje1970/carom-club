"use client";

import type { LeagueDetailView, LeagueMatchView, LeagueRoundView, LeagueStandingView, LeagueSummary } from "@/lib/league-view";

export function LeagueKindLabel(kind: LeagueSummary["kind"]) {
  if (kind === "MAIN") return "메인";
  if (kind === "ZONE") return "권역";
  return "본선";
}

export function LeagueStatusBadge({
  status,
}: {
  status: LeagueDetailView["status"] | LeagueSummary["status"] | LeagueMatchView["status"];
}) {
  const cls =
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
      : status === "GENERATED"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
        : status === "IN_PROGRESS"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
          : status === "CANCELLED"
            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
            : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

export function LeagueEntryStatusBadge({ status }: { status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED" }) {
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
      : status === "WITHDRAWN"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  const label = status === "ACTIVE" ? "활성" : status === "WITHDRAWN" ? "제외" : "자동 제외";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function scoreText(match: LeagueMatchView) {
  if (match.scoreA == null && match.scoreB == null) return "-";
  return `${match.scoreA ?? 0} : ${match.scoreB ?? 0}`;
}

export function LeagueMatchesTable({
  rounds,
  entriesById,
}: {
  rounds: LeagueRoundView[];
  entriesById: Record<string, string>;
}) {
  if (rounds.length === 0) {
    return <p className="rounded-xl border border-site-border bg-site-card p-4 text-sm text-gray-500">경기가 아직 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      {rounds.map((round) => (
        <section key={round.id} className="space-y-3">
          <h3 className="text-base font-semibold text-site-text">
            {round.roundNumber}라운드 · {round.name}
          </h3>
          <div className="overflow-hidden rounded-xl border border-site-border bg-site-card">
            <table className="min-w-full divide-y divide-site-border text-sm">
              <thead className="bg-site-bg">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">경기</th>
                  <th className="px-4 py-3 font-medium">A</th>
                  <th className="px-4 py-3 font-medium">B</th>
                  <th className="px-4 py-3 font-medium">점수</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-site-border">
                {round.matches.map((match) => {
                  const a = match.leagueEntryA?.displayName ?? entriesById[match.leagueEntryIdA ?? ""] ?? "—";
                  const b = match.leagueEntryB?.displayName ?? entriesById[match.leagueEntryIdB ?? ""] ?? "—";
                  const winnerId = match.winnerLeagueEntryId ?? match.winnerLeagueEntry?.id ?? null;
                  return (
                    <tr key={match.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-site-text">#{match.matchNumber + 1}</td>
                      <td
                        className={`px-4 py-3 ${
                          winnerId != null && winnerId === match.leagueEntryIdA ? "font-semibold text-site-text" : "text-gray-600"
                        }`}
                      >
                        {a}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          winnerId != null && winnerId === match.leagueEntryIdB ? "font-semibold text-site-text" : "text-gray-600"
                        }`}
                      >
                        {b}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{scoreText(match)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <LeagueStatusBadge status={match.status} />
                          {match.isWalkover && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">부전승</span>}
                          {match.isForcedZeroPoint && (
                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              0점 처리
                            </span>
                          )}
                          {match.isManualOverride && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">수동</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export function LeagueStandingsTable({
  standings,
}: {
  standings: LeagueStandingView[];
}) {
  if (standings.length === 0) {
    return <p className="rounded-xl border border-site-border bg-site-card p-4 text-sm text-gray-500">순위가 아직 없습니다.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-site-border bg-site-card">
      <table className="min-w-full divide-y divide-site-border text-sm">
        <thead className="bg-site-bg">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">순위</th>
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">경기</th>
            <th className="px-4 py-3 font-medium">승</th>
            <th className="px-4 py-3 font-medium">무</th>
            <th className="px-4 py-3 font-medium">패</th>
            <th className="px-4 py-3 font-medium">승점</th>
            <th className="px-4 py-3 font-medium">득실</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-site-border">
          {standings.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-semibold text-site-text">{row.rank ?? "-"}</td>
              <td className="px-4 py-3 text-gray-700">
                <div className="font-medium text-site-text">{row.leagueEntry?.displayName ?? row.entryId}</div>
                {row.leagueEntry?.levelCode && <div className="text-xs text-gray-500">{row.leagueEntry.levelCode}</div>}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.played}</td>
              <td className="px-4 py-3 text-gray-700">{row.won}</td>
              <td className="px-4 py-3 text-gray-700">{row.drawn}</td>
              <td className="px-4 py-3 text-gray-700">{row.lost}</td>
              <td className="px-4 py-3 font-semibold text-site-text">{row.points}</td>
              <td className="px-4 py-3 text-gray-700">{row.scoreDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
