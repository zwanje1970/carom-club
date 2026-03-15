"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  tournamentZone: { id: string; name: string; code: string | null; tournamentName: string };
  matches: Match[];
  stats: { total: number; completed: number; pending: number; inProgress: number };
};

export function ZoneBracketClient({ tzId, allowEdit }: { tzId: string; allowEdit: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  function load() {
    fetch(`/api/zone/tournament-zones/${tzId}/bracket`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tzId]);

  async function setResult(matchId: string, winnerEntryId: string | null, scoreA?: number, scoreB?: number) {
    setUpdating(matchId);
    try {
      const res = await fetch(`/api/zone/tournament-zones/${tzId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerEntryId: winnerEntryId || undefined,
          scoreA: scoreA ?? undefined,
          scoreB: scoreB ?? undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "저장 실패");
        return;
      }
      load();
      router.refresh();
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">불러오는 중...</p>;
  if (!data) return <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다.</p>;

  const byRound = data.matches.reduce<Record<number, Match[]>>((acc, m) => {
    if (!acc[m.roundIndex]) acc[m.roundIndex] = [];
    acc[m.roundIndex].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>전체 {data.stats.total}경기</span>
        <span className="text-green-600">완료 {data.stats.completed}</span>
        <span className="text-amber-600">대기 {data.stats.pending}</span>
      </div>

      {Object.keys(byRound).length === 0 ? (
        <p className="text-gray-500">대진표가 없습니다. 대회 총관리자가 권역 대진을 생성하면 표시됩니다.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(byRound)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, matches]) => (
              <div key={round}>
                <h3 className="mb-2 font-medium text-site-text">{Number(round) + 1}라운드</h3>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-site-border bg-site-card p-3"
                    >
                      <span className="w-8 text-gray-500">#{m.matchIndex + 1}</span>
                      <span className={m.entryAName ? "font-medium" : "text-gray-400"}>
                        {m.entryAName ?? "BYE"}
                      </span>
                      <span className="text-gray-400">vs</span>
                      <span className={m.entryBName ? "font-medium" : "text-gray-400"}>
                        {m.entryBName ?? "BYE"}
                      </span>
                      {m.status === "COMPLETED" && (
                        <span className="text-sm text-green-600">
                          승: {m.winnerEntryId === m.entryIdA ? m.entryAName : m.entryBName}
                          {m.scoreA != null && m.scoreB != null && ` (${m.scoreA}-${m.scoreB})`}
                        </span>
                      )}
                      {allowEdit && (m.status === "PENDING" || m.status === "IN_PROGRESS") && m.entryIdA && m.entryIdB && (
                        <span className="flex gap-2 ml-auto">
                          <button
                            type="button"
                            disabled={updating === m.id}
                            onClick={() => setResult(m.id, m.entryIdA)}
                            className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300 disabled:opacity-50 dark:bg-slate-700"
                          >
                            {m.entryAName} 승
                          </button>
                          <button
                            type="button"
                            disabled={updating === m.id}
                            onClick={() => setResult(m.id, m.entryIdB)}
                            className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300 disabled:opacity-50 dark:bg-slate-700"
                          >
                            {m.entryBName} 승
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
