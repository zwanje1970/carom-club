"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ZoneQual = {
  tournamentZoneId: string;
  zoneName: string;
  advanceCount: number;
  saved: number;
  computed: number;
  qualifiers: { entryId: string; userName: string; qualifiedRank: number }[];
};

type QualifiedResponse = {
  tournamentId: string;
  savedCount: number;
  computedTotal: number;
  byZone: ZoneQual[];
  canCollect: boolean;
};

type FinalMatch = {
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

type FinalBracketResponse = {
  tournamentId: string;
  matches: FinalMatch[];
  stats: { total: number; completed: number; pending: number };
};

export function FinalStageSection({
  tournamentId,
  basePath,
  zones,
}: {
  tournamentId: string;
  basePath: string;
  zones: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [qual, setQual] = useState<QualifiedResponse | null>(null);
  const [bracket, setBracket] = useState<FinalBracketResponse | null>(null);
  const [loadingQual, setLoadingQual] = useState(true);
  const [loadingBracket, setLoadingBracket] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genSize, setGenSize] = useState<32 | 64>(32);
  const [genMode, setGenMode] = useState<"auto" | "manual">("auto");
  const [updatingMatch, setUpdatingMatch] = useState<string | null>(null);

  function loadQualified() {
    setLoadingQual(true);
    fetch(`/api/admin/tournaments/${tournamentId}/qualified-participants`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setQual)
      .finally(() => setLoadingQual(false));
  }

  function loadBracket() {
    setLoadingBracket(true);
    fetch(`/api/admin/tournaments/${tournamentId}/final-bracket`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBracket)
      .finally(() => setLoadingBracket(false));
  }

  useEffect(() => {
    loadQualified();
  }, [tournamentId]);
  useEffect(() => {
    loadBracket();
  }, [tournamentId]);

  async function collect() {
    if (!qual?.canCollect) return;
    setCollecting(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/qualified-participants`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "취합 실패");
        return;
      }
      loadQualified();
      router.refresh();
    } finally {
      setCollecting(false);
    }
  }

  async function generateBracket() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/final-bracket/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: genSize, assignMode: genMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "본선 생성 실패");
        return;
      }
      loadBracket();
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function setMatchResult(matchId: string, winnerEntryId: string | null) {
    setUpdatingMatch(matchId);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/final-matches/${matchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerEntryId: winnerEntryId || undefined, status: "COMPLETED" }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장 실패");
        return;
      }
      loadBracket();
      router.refresh();
    } finally {
      setUpdatingMatch(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* 권역별 결과 링크 */}
      {zones.length > 0 && (
        <section>
          <h3 className="mb-2 text-lg font-semibold text-site-text">권역별 결과 입력</h3>
          <p className="mb-3 text-sm text-gray-500">
            각 권역에서 대진표를 생성한 뒤 결과를 입력하면, 진출 규칙에 따라 본선 진출자가 산출됩니다.
          </p>
          <ul className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <li key={z.id}>
                <Link
                  href={`${basePath}/zones/${z.id}/results`}
                  className="rounded-lg border border-site-border bg-site-card px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  {z.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 권역별 진출 현황 + 본선 진출자 취합 */}
      <section className="rounded-lg border border-site-border bg-site-card p-6">
        <h3 className="mb-2 text-lg font-semibold text-site-text">권역별 진출 현황</h3>
        {loadingQual ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : qual ? (
          <>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-site-border text-left">
                    <th className="py-2 pr-2">권역</th>
                    <th className="py-2 pr-2">진출 규칙</th>
                    <th className="py-2 pr-2">추출 가능</th>
                    <th className="py-2 pr-2">저장됨</th>
                  </tr>
                </thead>
                <tbody>
                  {qual.byZone.map((z) => (
                    <tr key={z.tournamentZoneId} className="border-b border-site-border/50">
                      <td className="py-2 pr-2 font-medium">{z.zoneName}</td>
                      <td className="py-2 pr-2">상위 {z.advanceCount}명</td>
                      <td className="py-2 pr-2">{z.computed}</td>
                      <td className="py-2 pr-2">{z.saved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mb-3 text-sm text-gray-600">
              전체 추출 가능: <strong>{qual.computedTotal}</strong>명 · 저장된 본선 진출자: <strong>{qual.savedCount}</strong>명
            </p>
            {qual.canCollect && (
              <button
                type="button"
                onClick={collect}
                disabled={collecting}
                className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {collecting ? "취합 중…" : "진출자 취합"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다.</p>
        )}
      </section>

      {/* 본선 진출자 목록 */}
      {qual && qual.savedCount > 0 && (
        <section className="rounded-lg border border-site-border bg-site-card p-6">
          <h3 className="mb-2 text-lg font-semibold text-site-text">본선 진출자 목록</h3>
          <ul className="max-h-48 list-inside list-disc overflow-y-auto text-sm">
            {qual.byZone.flatMap((z) =>
              z.qualifiers.map((q) => (
                <li key={`${z.tournamentZoneId}-${q.entryId}-${q.qualifiedRank}`}>
                  [{z.zoneName}] {q.qualifiedRank}위 {q.userName}
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      {/* 본선 생성 */}
      {qual && qual.savedCount >= 2 && !bracket?.matches?.length && (
        <section className="rounded-lg border border-site-border bg-site-card p-6">
          <h3 className="mb-2 text-lg font-semibold text-site-text">본선 생성</h3>
          <p className="mb-4 text-sm text-gray-500">
            32강 또는 64강 본선 대진을 생성합니다. 자동배정은 같은 권역 1회전 충돌을 최소화합니다.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="size"
                checked={genSize === 32}
                onChange={() => setGenSize(32)}
              />
              <span className="text-sm">32강</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="size"
                checked={genSize === 64}
                onChange={() => setGenSize(64)}
              />
              <span className="text-sm">64강</span>
            </label>
            <label className="ml-4 flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={genMode === "auto"}
                onChange={() => setGenMode("auto")}
              />
              <span className="text-sm">자동배정</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={genMode === "manual"}
                onChange={() => setGenMode("manual")}
              />
              <span className="text-sm">수동배정</span>
            </label>
          </div>
          <button
            type="button"
            onClick={generateBracket}
            disabled={generating}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "생성 중…" : "본선 대진표 생성"}
          </button>
        </section>
      )}

      {/* 본선 대진표 및 결과 입력 */}
      {bracket && bracket.matches?.length > 0 && (
        <section className="rounded-lg border border-site-border bg-site-card p-6">
          <h3 className="mb-2 text-lg font-semibold text-site-text">본선 대진표 · 결과</h3>
          <p className="mb-4 text-sm text-gray-500">
            완료 {bracket.stats.completed} / 전체 {bracket.stats.total}
          </p>
          {loadingBracket ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : (
            <div className="space-y-6">
              {[0, 1, 2, 3, 4, 5].map((roundIndex) => {
                const roundMatches = bracket.matches.filter((m) => m.roundIndex === roundIndex);
                if (roundMatches.length === 0) return null;
                const roundLabel = ["1라운드", "2라운드", "준준결승", "준결승", "결승", "결승(64강)"][roundIndex] ?? `${roundIndex + 1}라운드`;
                return (
                  <div key={roundIndex}>
                    <h4 className="mb-2 text-sm font-medium text-gray-600">{roundLabel}</h4>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {roundMatches.map((m) => (
                        <div
                          key={m.id}
                          className="rounded border border-site-border bg-site-bg p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={m.winnerEntryId === m.entryIdA ? "font-semibold" : ""}>
                              {m.entryAName ?? "—"}
                            </span>
                            {(m.scoreA != null || m.scoreB != null) && (
                              <span>
                                {m.scoreA ?? 0} : {m.scoreB ?? 0}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className={m.winnerEntryId === m.entryIdB ? "font-semibold" : ""}>
                              {m.entryBName ?? "—"}
                            </span>
                            {m.status !== "COMPLETED" && m.entryIdA && m.entryIdB && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setMatchResult(m.id, m.entryIdA)}
                                  disabled={!!updatingMatch}
                                  className="rounded bg-gray-200 px-2 py-0.5 text-xs hover:bg-gray-300 dark:bg-slate-700"
                                >
                                  A승
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMatchResult(m.id, m.entryIdB)}
                                  disabled={!!updatingMatch}
                                  className="rounded bg-gray-200 px-2 py-0.5 text-xs hover:bg-gray-300 dark:bg-slate-700"
                                >
                                  B승
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
