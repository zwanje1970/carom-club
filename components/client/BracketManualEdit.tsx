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

type ConfirmedEntry = {
  id: string;
  label: string;
  slotNumber: number;
};

const ROUND_LABELS: Record<number, string> = {
  0: "1라운드",
  1: "2라운드",
  2: "준준결승",
  3: "준결승",
  4: "결승",
  5: "결승",
};

export function BracketManualEdit({ tournamentId }: { tournamentId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<ConfirmedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/tournaments/${tournamentId}/final-bracket`).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/admin/tournaments/${tournamentId}/confirmed-entries`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([bracketRes, entriesRes]) => {
        if (bracketRes?.matches) setMatches(bracketRes.matches);
        if (entriesRes?.entries) setEntries(entriesRes.entries);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const byRound = useMemo(() => {
    const map: Record<number, Match[]> = {};
    for (const m of matches) {
      if (!map[m.roundIndex]) map[m.roundIndex] = [];
      map[m.roundIndex].push(m);
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => a.matchIndex - b.matchIndex);
    return map;
  }, [matches]);

  const roundOrder = Object.keys(byRound)
    .map(Number)
    .sort((a, b) => a - b);

  async function refetchBracket() {
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/final-bracket`);
    if (res.ok) {
      const data = await res.json();
      if (data.matches) setMatches(data.matches);
    }
  }

  async function updateMatch(
    matchId: string,
    payload: {
      entryIdA?: string | null;
      entryIdB?: string | null;
      winnerEntryId?: string | null;
      scoreA?: number | null;
      scoreB?: number | null;
    }
  ) {
    setSaving(matchId);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/final-matches/${matchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      const affectsDownstream =
        payload.entryIdA !== undefined || payload.entryIdB !== undefined || payload.winnerEntryId !== undefined;
      if (affectsDownstream) {
        await refetchBracket();
      } else {
        setMatches((prev) =>
          prev.map((m) => {
            if (m.id !== matchId) return m;
            return {
              ...m,
              scoreA: payload.scoreA !== undefined ? payload.scoreA : m.scoreA,
              scoreB: payload.scoreB !== undefined ? payload.scoreB : m.scoreB,
            };
          })
        );
      }
    } finally {
      setSaving(null);
    }
  }

  function handleSlotChange(m: Match, slot: "A" | "B", entryId: string | null) {
    updateMatch(m.id, slot === "A" ? { entryIdA: entryId } : { entryIdB: entryId });
  }

  function handleWinnerChange(m: Match, winnerEntryId: string | null) {
    updateMatch(m.id, { winnerEntryId });
  }

  function handleScoreChange(m: Match, side: "A" | "B", value: string) {
    const num = value === "" ? null : parseInt(value, 10);
    if (num !== null && (num < 0 || Number.isNaN(num))) return;
    updateMatch(m.id, side === "A" ? { scoreA: num ?? null } : { scoreB: num ?? null });
  }

  if (loading) return <p className="text-sm text-gray-500 py-2">불러오는 중…</p>;
  if (matches.length === 0) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-site-text">대진표 강제 수정</h3>
        <p className="text-xs text-gray-500 mt-1">
          모든 라운드·모든 경기를 언제든 수정할 수 있습니다. 참가자 강제입력·교체·추가(빈칸 채우기)·삭제(빈칸) 가능.
          수정 시 해당 경기에서 진출하는 다음 라운드부터 슬롯이 비워지며, 승자를 다시 입력하면 자동 반영됩니다.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-6">
        {roundOrder.map((roundIndex) => {
          const list = byRound[roundIndex] ?? [];
          const label = ROUND_LABELS[roundIndex] ?? `${roundIndex + 1}라운드`;
          return (
            <div key={roundIndex} className="rounded-lg border border-site-border overflow-hidden">
              <div className="bg-gray-50 dark:bg-slate-800/50 px-3 py-2 border-b border-site-border">
                <span className="text-sm font-medium text-site-text">{label}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-site-border bg-site-bg">
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text w-20">경기</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text">A (참가자)</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text">B (참가자)</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text w-24">점수 A</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text w-24">점수 B</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-site-text">승자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id} className="border-b border-site-border last:border-b-0">
                        <td className="py-2 px-3 text-xs text-gray-600 dark:text-slate-400">
                          {m.matchIndex + 1}차전
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={m.entryIdA ?? ""}
                            onChange={(e) => handleSlotChange(m, "A", e.target.value || null)}
                            disabled={!!saving}
                            className="w-full max-w-[180px] rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm disabled:opacity-50"
                          >
                            <option value="">— 빈칸/BYE —</option>
                            {entries.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={m.entryIdB ?? ""}
                            onChange={(e) => handleSlotChange(m, "B", e.target.value || null)}
                            disabled={!!saving}
                            className="w-full max-w-[180px] rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm disabled:opacity-50"
                          >
                            <option value="">— 빈칸/BYE —</option>
                            {entries.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            value={m.scoreA ?? ""}
                            onChange={(e) => handleScoreChange(m, "A", e.target.value)}
                            disabled={!!saving}
                            className="w-16 rounded border border-site-border bg-site-bg px-2 py-1 text-sm disabled:opacity-50"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            value={m.scoreB ?? ""}
                            onChange={(e) => handleScoreChange(m, "B", e.target.value)}
                            disabled={!!saving}
                            className="w-16 rounded border border-site-border bg-site-bg px-2 py-1 text-sm disabled:opacity-50"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={m.winnerEntryId ?? ""}
                            onChange={(e) => handleWinnerChange(m, e.target.value || null)}
                            disabled={!!saving}
                            className="w-full max-w-[160px] rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm disabled:opacity-50"
                          >
                            <option value="">— 미정 —</option>
                            {m.entryIdA && (
                              <option value={m.entryIdA}>
                                {m.entryAName ?? entries.find((e) => e.id === m.entryIdA)?.label ?? m.entryIdA}
                              </option>
                            )}
                            {m.entryIdB && (
                              <option value={m.entryIdB}>
                                {m.entryBName ?? entries.find((e) => e.id === m.entryIdB)?.label ?? m.entryIdB}
                              </option>
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      {saving && <p className="text-xs text-gray-500">저장 중…</p>}
    </div>
  );
}
