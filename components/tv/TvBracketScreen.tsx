"use client";

import { useEffect, useMemo, useState } from "react";

type Match = {
  id: string;
  roundType: "NORMAL" | "REDUCTION";
  roundIndex: number;
  matchIndex: number;
  isBye?: boolean;
  isReduction?: boolean;
  entryAName: string | null;
  entryBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: string;
  winnerEntryId: string | null;
};

type Round = {
  roundType: "NORMAL" | "REDUCTION";
  roundIndex: number;
  name: string;
  targetSize: number;
  matches: Match[];
};

type ApiData = {
  tournamentName: string;
  contextLabel: string;
  rounds: Round[];
  stats: { total: number; completed: number; pending: number; inProgress: number; bye: number; reduction: number };
  currentRoundLabel: string | null;
  lastUpdatedAt: string | null;
};

type Tone = "emerald" | "amber" | "sky" | "slate" | "orange" | "violet";

function statusBadge(status: string, isBye?: boolean) {
  if (isBye) {
    return <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-800">부전승</span>;
  }
  switch (status) {
    case "COMPLETED":
      return <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300">완료</span>;
    case "IN_PROGRESS":
      return <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm font-semibold text-sky-300">진행중</span>;
    case "PENDING":
    case "READY":
      return <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-300">대기</span>;
    default:
      return <span className="rounded-full bg-slate-500/20 px-3 py-1 text-sm font-semibold text-slate-300">예정</span>;
  }
}

function roundTitle(round: Round) {
  if (round.roundType === "REDUCTION") return "감축경기";
  return round.name || `${round.roundIndex + 1}라운드`;
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "방금";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function TvBracketScreen({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as ApiData & { error?: string };
      if (!res.ok) {
        setError(json.error || "TV 데이터를 불러오지 못했습니다.");
        return;
      }
      setData(json);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch {
      setError("TV 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const reductionRounds = useMemo(() => data?.rounds.filter((round) => round.roundType === "REDUCTION") ?? [], [data]);
  const normalRounds = useMemo(() => data?.rounds.filter((round) => round.roundType !== "REDUCTION") ?? [], [data]);
  const currentRound = useMemo(() => {
    if (!data?.rounds?.length) return null;
    return data.rounds.find((round) => round.matches.some((match) => match.status !== "COMPLETED")) ?? data.rounds[data.rounds.length - 1] ?? null;
  }, [data]);

  if (loading && !data) {
    return <div className="flex min-h-[60vh] items-center justify-center text-2xl text-slate-300">TV 대진표를 불러오는 중...</div>;
  }
  if (error && !data) {
    return <div className="flex min-h-[60vh] items-center justify-center text-2xl text-rose-300">{error}</div>;
  }

  const stats = data?.stats ?? { total: 0, completed: 0, pending: 0, inProgress: 0, bye: 0, reduction: 0 };

  return (
    <div className="space-y-6 text-white">
      <header className="rounded-[2rem] border border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">TV LIVE</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">{data?.tournamentName ?? "대회"}</h1>
            <p className="text-xl text-slate-300">{data?.contextLabel}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>현재 라운드 {currentRound ? roundTitle(currentRound) : "대기"}</span>
              <span>마지막 갱신 {formatUpdatedAt(updatedAt ?? data?.lastUpdatedAt ?? null)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:w-[520px] xl:grid-cols-3">
            <SummaryCard label="완료" value={`${stats.completed}`} tone="emerald" />
            <SummaryCard label="대기" value={`${stats.pending}`} tone="amber" />
            <SummaryCard label="진행중" value={`${stats.inProgress}`} tone="sky" />
            <SummaryCard label="부전승" value={`${stats.bye}`} tone="slate" />
            <SummaryCard label="감축경기" value={`${stats.reduction}`} tone="orange" />
            <SummaryCard label="전체" value={`${stats.total}`} tone="violet" />
          </div>
        </div>
      </header>

      {reductionRounds.length > 0 && (
        <section className="rounded-[2rem] border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">Reduction</p>
              <h2 className="text-2xl font-black text-amber-50 md:text-4xl">감축경기</h2>
            </div>
            <p className="text-lg font-semibold text-amber-100">
              감축경기 {reductionRounds.reduce((sum, round) => sum + round.matches.length, 0)}개
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {reductionRounds.map((round) => (
              <RoundCard key={`${round.roundType}-${round.roundIndex}`} round={round} highlight={currentRound?.roundType === "REDUCTION" && currentRound.roundIndex === round.roundIndex} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white md:text-4xl">정상 라운드</h2>
          {normalRounds.length > 0 && <p className="text-sm text-slate-400">감축 후 이어지는 본 라운드</p>}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {normalRounds.map((round) => (
            <RoundCard key={`${round.roundType}-${round.roundIndex}`} round={round} highlight={currentRound?.roundType !== "REDUCTION" && currentRound?.roundIndex === round.roundIndex} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const toneClass: Record<Tone, string> = {
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    amber: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    sky: "border-sky-400/30 bg-sky-500/15 text-sky-100",
    slate: "border-slate-400/30 bg-slate-500/15 text-slate-100",
    orange: "border-orange-400/30 bg-orange-500/15 text-orange-100",
    violet: "border-violet-400/30 bg-violet-500/15 text-violet-100",
  };
  return (
    <div className={`rounded-2xl border p-4 text-center shadow ${toneClass[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-black md:text-4xl">{value}</div>
    </div>
  );
}

function RoundCard({
  round,
  highlight,
}: {
  round: Round;
  highlight: boolean;
}) {
  return (
    <article
      className={`rounded-[2rem] border p-5 shadow-xl ${
        round.roundType === "REDUCTION"
          ? "border-amber-500/30 bg-amber-500/10"
          : highlight
            ? "border-cyan-400/50 bg-slate-900/90 ring-2 ring-cyan-400/30"
            : "border-slate-700 bg-slate-900/80"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Round</p>
          <h3 className="text-2xl font-black md:text-3xl">
            {roundTitle(round)}
            {round.roundType === "REDUCTION" && <span className="ml-3 text-lg text-amber-300">독립 감축 단계</span>}
          </h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          {round.matches.length}경기
        </div>
      </div>
      <div className="grid gap-3">
        {round.matches.map((match) => (
          <div
            key={match.id}
            className={`rounded-2xl border p-4 ${
              match.status === "IN_PROGRESS"
                ? "border-sky-400/50 bg-sky-500/10"
                : match.status === "COMPLETED"
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : round.roundType === "REDUCTION"
                    ? "border-amber-400/30 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 text-2xl font-semibold">
                  <span className="text-slate-400">#{match.matchIndex + 1}</span>
                  <span className="truncate">{match.entryAName ?? "—"}</span>
                  {(match.scoreA != null || match.scoreB != null) && <span className="text-sm text-slate-400">({match.scoreA ?? 0})</span>}
                </div>
                <div className="mt-2 flex items-center gap-3 text-2xl font-semibold text-slate-100">
                  <span className="text-slate-400">vs</span>
                  <span className="truncate">{match.entryBName ?? "—"}</span>
                  {(match.scoreA != null || match.scoreB != null) && <span className="text-sm text-slate-400">({match.scoreB ?? 0})</span>}
                </div>
              </div>
              <div className="shrink-0">{statusBadge(match.status, match.isBye)}</div>
            </div>
            {round.roundType === "REDUCTION" && (
              <div className="mt-3 text-sm font-semibold text-amber-200">감축경기</div>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
