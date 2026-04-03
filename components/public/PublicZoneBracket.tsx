"use client";

import { useEffect, useState, useMemo } from "react";

type Match = {
  id: string;
  roundType?: "NORMAL" | "REDUCTION";
  roundIndex: number;
  matchIndex: number;
  isBye?: boolean;
  isReduction?: boolean;
  entryIdA: string | null;
  entryIdB: string | null;
  entryAName: string | null;
  entryBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  status: string;
};

type Round = {
  roundType: "NORMAL" | "REDUCTION";
  roundIndex: number;
  name: string;
  targetSize: number;
  matches: Match[];
};

type Data = {
  zone: { id: string; name: string; code: string | null };
  rounds?: Round[];
  matches: Match[];
  stats: { total: number; completed: number; pending: number; inProgress: number };
};

function statusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">완료</span>;
    case "IN_PROGRESS":
      return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">진행중</span>;
    case "READY":
      return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">대기</span>;
    case "BYE":
      return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">부전승</span>;
    default:
      return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">예정</span>;
  }
}

function roundLabel(round: Round) {
  if (round.roundType === "REDUCTION") return "감축경기";
  return `${round.roundIndex}라운드`;
}

export function PublicZoneBracket({
  tournamentId,
  tzId,
  zoneName,
}: {
  tournamentId: string;
  tzId: string;
  zoneName: string;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/public/tournaments/${tournamentId}/zones/${tzId}/bracket`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [tournamentId, tzId]);

  const rounds = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const sourceRounds: Round[] = data.rounds?.length
      ? data.rounds
      : Object.entries(
          data.matches.reduce<Record<number, Match[]>>((acc, m) => {
            if (!acc[m.roundIndex]) acc[m.roundIndex] = [];
            acc[m.roundIndex].push(m);
            return acc;
          }, {})
        )
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([roundIndex, matches]) => ({
            roundType: "NORMAL" as const,
            roundIndex: Number(roundIndex) + 1,
            name: `${Number(roundIndex) + 1}라운드`,
            targetSize: matches.length,
            matches,
          }));

    return sourceRounds
      .map((round) => ({
        ...round,
        matches: q
          ? round.matches.filter(
              (m) =>
                m.entryAName?.toLowerCase().includes(q) ||
                m.entryBName?.toLowerCase().includes(q)
            )
          : round.matches,
      }))
      .filter((round) => round.matches.length > 0);
  }, [data, search]);

  if (loading) return <p className="text-sm text-gray-500 py-4">불러오는 중…</p>;
  if (!data) return <p className="text-sm text-gray-500 py-4">대진표를 불러올 수 없습니다.</p>;
  if (data.matches.length === 0) return <p className="rounded-xl border border-site-border bg-site-card p-6 text-center text-gray-500">아직 대진이 생성되지 않았습니다.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-site-text">대진표</h2>
        <input
          type="search"
          placeholder="참가자명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-site-border bg-site-bg px-3 py-1.5 text-sm w-40 sm:w-48"
        />
      </div>
      {rounds.length === 0 ? (
        <p className="rounded-xl border border-site-border bg-site-card p-6 text-center text-gray-500">아직 대진이 생성되지 않았습니다.</p>
      ) : (
        rounds.map((round) => (
          <div key={`${round.roundType}-${round.roundIndex}`}>
            <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-slate-400">
              {roundLabel(round)}
              {round.roundType === "REDUCTION" && <span className="ml-2 text-xs text-amber-600">독립 감축 단계</span>}
            </h3>
            <ul className="space-y-2">
              {round.matches.map((m) => (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-lg border border-site-border bg-site-card"
                >
                  <div className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 ${m.winnerEntryId && m.entryIdA && m.winnerEntryId === m.entryIdA ? "font-semibold text-site-text" : "text-gray-600"}`}>
                        <span className="truncate">{m.entryAName ?? "—"}</span>
                        {(m.scoreA != null || m.scoreB != null) && (
                          <span className="shrink-0 text-gray-500">
                            {m.scoreA ?? 0} : {m.scoreB ?? 0}
                          </span>
                        )}
                      </div>
                      <div className={`mt-1 flex items-center gap-2 ${m.winnerEntryId && m.entryIdB && m.winnerEntryId === m.entryIdB ? "font-semibold text-site-text" : "text-gray-600"}`}>
                        <span className="truncate">{m.entryBName ?? "—"}</span>
                      </div>
                    </div>
                    <div className="shrink-0">{m.isBye ? statusBadge("BYE") : statusBadge(m.status)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
