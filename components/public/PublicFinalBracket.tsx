"use client";

import { useEffect, useState, useMemo } from "react";

type Match = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  entryAName: string | null;
  entryBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  status: string;
};

type Data = {
  tournamentId: string;
  tournamentName: string;
  matches: Match[];
  stats: { total: number; completed: number; pending: number };
};

const ROUND_LABELS: Record<number, string> = {
  0: "1라운드",
  1: "2라운드",
  2: "준준결승",
  3: "준결승",
  4: "결승",
  5: "결승",
};

function statusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">완료</span>;
    case "IN_PROGRESS":
      return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">진행중</span>;
    case "BYE":
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">부전승</span>;
    default:
      return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">예정</span>;
  }
}

export function PublicFinalBracket({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/public/tournaments/${tournamentId}/final-bracket`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const filteredByRound = useMemo(() => {
    if (!data) return {};
    const q = search.trim().toLowerCase();
    const matches = q
      ? data.matches.filter(
          (m) =>
            (m.entryAName?.toLowerCase().includes(q)) ||
            (m.entryBName?.toLowerCase().includes(q))
        )
      : data.matches;
    return matches.reduce<Record<number, Match[]>>((acc, m) => {
      if (!acc[m.roundIndex]) acc[m.roundIndex] = [];
      acc[m.roundIndex].push(m);
      return acc;
    }, {});
  }, [data, search]);

  if (loading) return <p className="text-sm text-gray-500 py-4">불러오는 중…</p>;
  if (!data) return <p className="text-sm text-gray-500 py-4">대진표를 불러올 수 없습니다.</p>();

  const roundOrder = Object.keys(filteredByRound)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          완료 {data.stats.completed} / 전체 {data.stats.total}경기
        </p>
        <input
          type="search"
          placeholder="참가자명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-site-border bg-site-bg px-3 py-1.5 text-sm w-40 sm:w-48"
        />
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {roundOrder.map((roundIndex) => {
            const matches = filteredByRound[Number(roundIndex)];
            if (!matches?.length) return null;
            const label = ROUND_LABELS[roundIndex] ?? `${roundIndex + 1}라운드`;
            return (
              <div key={roundIndex} className="w-56 shrink-0">
                <h3 className="text-sm font-medium text-gray-600 dark:text-slate-400 mb-2 sticky top-0 bg-site-bg py-1">
                  {label}
                </h3>
                <ul className="space-y-2">
                  {matches.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-site-border bg-site-card overflow-hidden"
                    >
                      <div className="p-2.5 text-sm">
                        <div className={`flex items-center justify-between gap-1 ${m.winnerEntryId && m.entryIdA && m.winnerEntryId === m.entryIdA ? "font-semibold text-site-text" : "text-gray-600"}`}>
                          <span className="truncate">{m.entryAName ?? "—"}</span>
                          {(m.scoreA != null || m.scoreB != null) && (
                            <span className="text-gray-500 shrink-0 text-xs">{m.scoreA ?? 0}</span>
                          )}
                        </div>
                        <div className={`flex items-center justify-between gap-1 mt-0.5 ${m.winnerEntryId && m.entryIdB && m.winnerEntryId === m.entryIdB ? "font-semibold text-site-text" : "text-gray-600"}`}>
                          <span className="truncate">{m.entryBName ?? "—"}</span>
                          {(m.scoreA != null || m.scoreB != null) && (
                            <span className="text-gray-500 shrink-0 text-xs">{m.scoreB ?? 0}</span>
                          )}
                        </div>
                        <div className="mt-1 flex justify-end">{statusBadge(m.status)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
