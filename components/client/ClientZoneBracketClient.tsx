"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  tournamentZone: { id: string; name: string; code: string | null };
  rounds?: Round[];
  matches: Match[];
  stats: { total: number; completed: number; pending: number; inProgress: number };
};

function roundLabel(round: Round) {
  if (round.roundType === "REDUCTION") return "감축경기";
  return `${round.roundIndex}라운드`;
}

type ManualDraftItem = { entryIdA: string; entryIdB: string };

export function ClientZoneBracketClient({
  tournamentId,
  tzId,
  allowEdit,
}: {
  tournamentId: string;
  tzId: string;
  allowEdit: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualDraft, setManualDraft] = useState<Record<string, ManualDraftItem>>({});

  function load() {
    fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}/bracket`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tournamentId, tzId]);

  async function setResult(matchId: string, winnerEntryId: string | null) {
    setUpdating(matchId);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}/matches/${matchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerEntryId: winnerEntryId || undefined }),
        }
      );
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

  const rounds = data.rounds?.length
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

  const reductionRounds = useMemo(() => rounds.filter((round) => round.roundType === "REDUCTION"), [rounds]);
  const participantOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.matches.forEach((match) => {
      if (match.entryIdA && match.entryAName) map.set(match.entryIdA, match.entryAName);
      if (match.entryIdB && match.entryBName) map.set(match.entryIdB, match.entryBName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  useEffect(() => {
    if (reductionRounds.length === 0) {
      setManualMode(false);
      setManualDraft({});
      return;
    }
    const draft: Record<string, ManualDraftItem> = {};
    reductionRounds.forEach((round) => {
      round.matches.forEach((match) => {
        draft[match.id] = {
          entryIdA: match.entryIdA ?? "",
          entryIdB: match.entryIdB ?? "",
        };
      });
    });
    setManualDraft(draft);
  }, [data, reductionRounds]);

  async function rerollReduction() {
    setUpdating("reduction-reroll");
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}/reduction-matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reroll" }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "재추첨 실패");
        return;
      }
      load();
      router.refresh();
    } finally {
      setUpdating(null);
    }
  }

  async function saveManualReduction() {
    const matches = reductionRounds.flatMap((round) =>
      round.matches.map((match) => ({
        matchId: match.id,
        entryIdA: manualDraft[match.id]?.entryIdA?.trim() || null,
        entryIdB: manualDraft[match.id]?.entryIdB?.trim() || null,
      }))
    );
    setUpdating("reduction-manual");
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}/reduction-matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual", matches }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "수동 지정 실패");
        return;
      }
      setManualMode(false);
      load();
      router.refresh();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>전체 {data.stats.total}경기</span>
        <span className="text-green-600">완료 {data.stats.completed}</span>
        <span className="text-amber-600">대기 {data.stats.pending}</span>
      </div>

      {reductionRounds.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              감축경기 {reductionRounds.reduce((sum, round) => sum + round.matches.length, 0)}개
            </span>
            <span className="text-amber-700 dark:text-amber-300">
              같은 부수 우선, 부족 시 ±1 부수 후보를 기준으로 재배치할 수 있습니다.
            </span>
            <button
              type="button"
              disabled={updating === "reduction-reroll"}
              onClick={rerollReduction}
              className="ml-auto rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {updating === "reduction-reroll" ? "재추첨 중..." : "감축경기 재추첨"}
            </button>
            <button
              type="button"
              onClick={() => setManualMode((value) => !value)}
              className="rounded border border-amber-400 px-3 py-1.5 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/30"
            >
              {manualMode ? "수동지정 닫기" : "수동지정"}
            </button>
          </div>
          {manualMode && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                감축경기 참가자를 직접 지정한 뒤 저장하세요. 저장 시 감축 경기 downstream은 초기화됩니다.
              </p>
              {reductionRounds.map((round) => (
                <div key={`${round.roundType}-${round.roundIndex}`} className="space-y-2 rounded border border-amber-200 bg-white/70 p-3 dark:border-amber-900/40 dark:bg-slate-950/40">
                  <div className="font-medium">{roundLabel(round)}</div>
                  {round.matches.map((match) => (
                    <div key={match.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <select
                        value={manualDraft[match.id]?.entryIdA ?? ""}
                        onChange={(e) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            [match.id]: {
                              entryIdA: e.target.value,
                              entryIdB: prev[match.id]?.entryIdB ?? "",
                            },
                          }))
                        }
                        className="rounded border border-site-border bg-site-bg px-3 py-2 text-sm"
                      >
                        <option value="">A 참가자 선택</option>
                        {participantOptions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={manualDraft[match.id]?.entryIdB ?? ""}
                        onChange={(e) =>
                          setManualDraft((prev) => ({
                            ...prev,
                            [match.id]: {
                              entryIdA: prev[match.id]?.entryIdA ?? "",
                              entryIdB: e.target.value,
                            },
                          }))
                        }
                        className="rounded border border-site-border bg-site-bg px-3 py-2 text-sm"
                      >
                        <option value="">B 참가자 선택</option>
                        {participantOptions.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-amber-700 dark:text-amber-300">
                        #{match.matchIndex + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={updating === "reduction-manual"}
                  onClick={saveManualReduction}
                  className="rounded bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {updating === "reduction-manual" ? "저장 중..." : "수동 지정 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="rounded border border-site-border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {rounds.length === 0 ? (
        <p className="text-gray-500">대진표가 없습니다. 부/권역 페이지에서 해당 권역의 대진 생성을 실행하세요.</p>
      ) : (
        <div className="space-y-6">
          {rounds.map((round) => (
            <div key={`${round.roundType}-${round.roundIndex}`}>
              <h3 className="mb-2 font-medium text-site-text">
                {roundLabel(round)}
                {round.roundType === "REDUCTION" && <span className="ml-2 text-xs text-amber-600">독립 감축 단계</span>}
              </h3>
              <div className="space-y-2">
                {round.matches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-site-border bg-site-card p-3"
                    >
                      <span className="w-8 text-gray-500">#{m.matchIndex + 1}</span>
                      <span className={m.entryAName ? "font-medium" : "text-gray-400"}>{m.entryAName ?? "BYE"}</span>
                      <span className="text-gray-400">vs</span>
                      <span className={m.entryBName ? "font-medium" : "text-gray-400"}>{m.entryBName ?? "BYE"}</span>
                      {m.status === "COMPLETED" && (
                        <span className="text-sm text-green-600">
                          승: {m.winnerEntryId === m.entryIdA ? m.entryAName : m.entryBName}
                          {m.scoreA != null && m.scoreB != null && ` (${m.scoreA}-${m.scoreB})`}
                        </span>
                      )}
                      {m.status !== "COMPLETED" && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {m.isBye ? "부전승" : m.status === "READY" ? "대기" : m.status}
                        </span>
                      )}
                      {allowEdit &&
                        (m.status === "PENDING" || m.status === "READY" || m.status === "IN_PROGRESS") &&
                        m.entryIdA &&
                        m.entryIdB && (
                          <span className="ml-auto flex gap-2">
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
