"use client";

import { useEffect, useMemo, useState } from "react";

type ZoneSummary = {
  id: string;
  name: string;
  code: string | null;
  total: number;
  completed: number;
  pending: number;
  reductionMatches: number;
  currentRoundLabel: string | null;
};

type ApiData = {
  tournamentName: string;
  tournamentStage: string;
  zoneCount: number;
  zoneCompleted: number;
  zoneTotal: number;
  zoneReductionTotal: number;
  qualifiedCount: number;
  finalBracketCreated: boolean;
  finalTotal: number;
  finalCompleted: number;
  zones: ZoneSummary[];
  lastUpdatedAt: string | null;
};

type Tone = "emerald" | "amber" | "sky" | "slate" | "orange" | "violet";

export function TvOverviewScreen({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as ApiData & { error?: string };
      if (!res.ok) {
        setError(json.error || "TV 요약을 불러오지 못했습니다.");
        return;
      }
      setData(json);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch {
      setError("TV 요약을 불러오지 못했습니다.");
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

  const stageLabel = useMemo(() => {
    if (!data) return "";
    switch (data.tournamentStage) {
      case "IN_PROGRESS":
        return "진행중";
      case "RECRUITING":
        return "모집중";
      case "RECRUIT_CLOSED":
        return "모집마감";
      case "COMPLETED":
        return "종료";
      default:
        return data.tournamentStage;
    }
  }, [data]);

  if (loading && !data) {
    return <div className="flex min-h-[60vh] items-center justify-center text-2xl text-slate-300">TV 요약을 불러오는 중...</div>;
  }
  if (error && !data) {
    return <div className="flex min-h-[60vh] items-center justify-center text-2xl text-rose-300">{error}</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <header className="rounded-[2rem] border border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">TV OVERVIEW</p>
            <h1 className="text-4xl font-black md:text-6xl">{data?.tournamentName ?? "대회"}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>진행 상태 {stageLabel}</span>
              <span>마지막 갱신 {formatUpdatedAt(updatedAt ?? data?.lastUpdatedAt ?? null)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:w-[640px] xl:grid-cols-3">
            <SummaryCard label="권역 수" value={`${data?.zoneCount ?? 0}`} tone="violet" />
            <SummaryCard label="권역 완료" value={`${data?.zoneCompleted ?? 0}`} tone="emerald" />
            <SummaryCard label="감축경기" value={`${data?.zoneReductionTotal ?? 0}`} tone="orange" />
            <SummaryCard label="본선 진출" value={`${data?.qualifiedCount ?? 0}`} tone="sky" />
            <SummaryCard label="본선 생성" value={data?.finalBracketCreated ? "있음" : "없음"} tone={data?.finalBracketCreated ? "emerald" : "slate"} />
            <SummaryCard label="본선 경기" value={`${data?.finalCompleted ?? 0}/${data?.finalTotal ?? 0}`} tone="amber" />
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-slate-700 bg-slate-900/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black md:text-4xl">권역별 진행 상태</h2>
          <p className="text-sm text-slate-400">권역별 감축경기와 완료 현황</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {(data?.zones ?? []).map((zone) => (
            <article
              key={zone.id}
              className={`rounded-[1.75rem] border p-5 shadow-lg ${
                zone.reductionMatches > 0
                  ? "border-amber-400/30 bg-amber-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-black md:text-3xl">{zone.name}</h3>
                  <p className="text-sm text-slate-400">{zone.code ?? "권역 코드 없음"}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                  {zone.currentRoundLabel ?? "대기"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <MiniStat label="완료" value={zone.completed} tone="emerald" />
                <MiniStat label="대기" value={zone.pending} tone="amber" />
                <MiniStat label="감축경기" value={zone.reductionMatches} tone="orange" />
              </div>

              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{ width: `${zone.total > 0 ? Math.round((zone.completed / zone.total) * 100) : 0}%` }}
                />
              </div>

              <div className="mt-3 text-sm text-slate-300">
                경기 {zone.completed} / {zone.total}
              </div>
            </article>
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "orange";
}) {
  const toneClass: Record<"emerald" | "amber" | "orange", string> = {
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    amber: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    orange: "border-orange-400/30 bg-orange-500/15 text-orange-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${toneClass[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
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
