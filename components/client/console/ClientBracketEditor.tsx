"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatKoreanDateTime } from "@/lib/format-date";
import {
  ConsoleActionBar,
  ConsolePageHeader,
  ConsoleSection,
} from "@/components/client/console/ui";
import { OperationsTournamentPhaseStepper } from "@/components/client/console/OperationsTournamentPhaseStepper";
import {
  buildOperationPhaseSteps,
  type OperationsPhaseView,
  type TournamentOperationPhaseSnapshot,
} from "@/lib/client-tournament-operation-phase";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextMuted } from "@/components/client/console/ui/tokens";

type ApiEntry = {
  id: string;
  userId: string;
  slotNumber: number;
  round: string | null;
  displayName: string;
};

type ApiVenue = {
  id: string;
  venueNumber: number;
  displayLabel: string;
};

export type BracketMatchRow = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  entryALabel: string | null;
  entryBLabel: string | null;
  divisionA: string | null;
  divisionB: string | null;
  venueLabel: string | null;
  matchVenueId: string | null;
  status: string;
  scheduledStartAt: string | null;
  hasIssue: boolean;
  issueNote: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusLabel(s: string): string {
  switch (s) {
    case "PENDING":
      return "대기";
    case "READY":
      return "준비";
    case "BYE":
      return "부전";
    case "IN_PROGRESS":
      return "진행";
    case "COMPLETED":
      return "완료";
    default:
      return s;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "IN_PROGRESS":
      return "bg-amber-200 text-amber-950 dark:bg-amber-700/50 dark:text-amber-50";
    case "READY":
      return "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100";
    case "BYE":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
    case "PENDING":
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

function cardOutlineClass(s: string, active: boolean): string {
  if (active) return "";
  if (s === "IN_PROGRESS") return "ring-2 ring-amber-500/90 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950";
  if (s === "READY") return "border-blue-400 dark:border-blue-500";
  if (s === "COMPLETED") return "border-emerald-300/80 dark:border-emerald-700";
  return "";
}

function sameScheduled(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function pickPatch(
  base: BracketMatchRow,
  cur: BracketMatchRow
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const keys: (keyof BracketMatchRow)[] = [
    "entryIdA",
    "entryIdB",
    "matchVenueId",
    "scheduledStartAt",
    "hasIssue",
    "issueNote",
    "scoreA",
    "scoreB",
    "winnerEntryId",
    "status",
  ];
  for (const k of keys) {
    if (k === "scheduledStartAt") {
      if (!sameScheduled(cur.scheduledStartAt, base.scheduledStartAt)) {
        patch.scheduledStartAt =
          cur.scheduledStartAt === null || cur.scheduledStartAt === ""
            ? null
            : cur.scheduledStartAt;
      }
      continue;
    }
    if (cur[k] !== base[k]) {
      patch[k] = cur[k];
    }
  }
  return patch;
}

export function ClientBracketEditor({
  tournamentId,
  tournamentName,
  listHref,
  operationPhase,
}: {
  tournamentId: string;
  tournamentName: string;
  listHref: string;
  operationPhase?: {
    snapshot: TournamentOperationPhaseSnapshot;
    currentView: OperationsPhaseView;
  };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tournamentStartAt, setTournamentStartAt] = useState<string | null>(null);
  const [matches, setMatches] = useState<BracketMatchRow[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [entries, setEntries] = useState<ApiEntry[]>([]);
  const [bracketOpsPolicy, setBracketOpsPolicy] = useState<{
    allowBracketCompletedResultEdit: boolean;
  }>({ allowBracketCompletedResultEdit: true });

  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 로컬에서만 덮어쓴 행 (서버 스냅샷 + 오버레이) */
  const [overrides, setOverrides] = useState<Record<string, Partial<BracketMatchRow>>>({});

  const [saving, setSaving] = useState(false);
  const [autoSortOpen, setAutoSortOpen] = useState(false);
  const [autoBase, setAutoBase] = useState("");
  const [autoInterval, setAutoInterval] = useState("25");
  const [autoRoundGap, setAutoRoundGap] = useState("5");

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/bracket-matches`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "불러오기 실패");
        return;
      }
      const list = (data.matches ?? []) as BracketMatchRow[];
      const keep = selectedRef.current;
      setTournamentStartAt(data.tournament?.startAt ?? null);
      setBracketOpsPolicy(
        data.bracketOpsPolicy ?? {
          allowBracketCompletedResultEdit: true,
        }
      );
      setMatches(list);
      setVenues(data.matchVenues ?? []);
      setEntries(data.entries ?? []);
      setOverrides({});
      setSelectedId(keep && list.some((m) => m.id === keep) ? keep : null);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  const merged = useCallback(
    (m: BracketMatchRow): BracketMatchRow => {
      const o = { ...m, ...(overrides[m.id] ?? {}) };
      const ea = o.entryIdA;
      const eb = o.entryIdB;
      return {
        ...o,
        divisionA: ea ? entries.find((e) => e.id === ea)?.round ?? o.divisionA : null,
        divisionB: eb ? entries.find((e) => e.id === eb)?.round ?? o.divisionB : null,
        entryALabel: ea ? entries.find((e) => e.id === ea)?.displayName ?? o.entryALabel : null,
        entryBLabel: eb ? entries.find((e) => e.id === eb)?.displayName ?? o.entryBLabel : null,
      };
    },
    [overrides, entries]
  );

  const roundOptions = useMemo(() => {
    const s = new Set(matches.map((m) => m.roundIndex));
    return Array.from(s).sort((a, b) => a - b);
  }, [matches]);

  const filtered = useMemo(() => {
    return matches
      .map(merged)
      .filter((m) => {
        if (roundFilter !== "all" && String(m.roundIndex) !== roundFilter) return false;
        if (venueFilter !== "all") {
          if (venueFilter === "unassigned" && m.matchVenueId) return false;
          if (venueFilter !== "unassigned" && m.matchVenueId !== venueFilter) return false;
        }
        return true;
      });
  }, [matches, merged, roundFilter, venueFilter]);

  const byRound = useMemo(() => {
    const map = new Map<number, BracketMatchRow[]>();
    for (const m of filtered) {
      if (!map.has(m.roundIndex)) map.set(m.roundIndex, []);
      map.get(m.roundIndex)!.push(m);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.matchIndex - b.matchIndex);
    }
    return map;
  }, [filtered]);

  const roundColumns = useMemo(() => {
    return Array.from(byRound.keys()).sort((a, b) => a - b);
  }, [byRound]);

  const selectMatch = (id: string) => {
    setSelectedId(id);
  };

  const detail = useMemo((): BracketMatchRow | null => {
    if (!selectedId) return null;
    const m = matches.find((x) => x.id === selectedId);
    return m ? merged(m) : null;
  }, [selectedId, matches, merged]);

  const entryLabel = (entryId: string | null) => {
    if (!entryId) return "—";
    return entries.find((e) => e.id === entryId)?.displayName ?? entryId.slice(0, 8);
  };

  const updateDetail = (patch: Partial<BracketMatchRow>) => {
    if (!selectedId) return;
    setOverrides((o) => ({ ...o, [selectedId]: { ...(o[selectedId] ?? {}), ...patch } }));
  };

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of matches) {
      const cur = merged(m);
      const patch = pickPatch(m, cur);
      if (Object.keys(patch).length > 0) ids.push(m.id);
    }
    return ids;
  }, [matches, merged]);

  const detailDirty = useMemo(() => {
    if (!selectedId) return false;
    const base = matches.find((x) => x.id === selectedId);
    if (!base) return false;
    return Object.keys(pickPatch(base, merged(base))).length > 0;
  }, [selectedId, matches, merged]);

  const saveMatch = async (id: string) => {
    const base = matches.find((x) => x.id === id);
    if (!base) return;
    const cur = merged(base);
    const patch = pickPatch(base, cur);
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/bracket-matches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장 실패");
        return;
      }
      setOverrides((o) => {
        const { [id]: _, ...rest } = o;
        return rest;
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const updates = dirtyIds.map((id) => {
      const base = matches.find((x) => x.id === id)!;
      const cur = merged(base);
      return { matchId: id, ...pickPatch(base, cur) };
    });
    if (updates.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/bracket-matches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "일부 저장 실패");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const runAutoSort = async () => {
    const baseIso = autoBase.trim()
      ? new Date(autoBase).toISOString()
      : tournamentStartAt
        ? new Date(tournamentStartAt).toISOString()
        : null;
    if (!baseIso) {
      setError("자동 정렬 기준 시각을 입력하거나 대회 시작일을 설정하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/bracket-matches/auto-sort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseStartAt: baseIso,
          intervalMinutes: parseInt(autoInterval, 10) || 25,
          roundGapMinutes: parseInt(autoRoundGap, 10) || 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "자동 정렬 실패");
        return;
      }
      setAutoSortOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openAutoSort = () => {
    const d = tournamentStartAt ? new Date(tournamentStartAt) : new Date();
    setAutoBase(toDatetimeLocalValue(d.toISOString()));
    setAutoSortOpen(true);
  };

  /** 서버 전용 PATCH(시작·결과 확정 등) — 성공 시 전체 재로드로 다음 경기 반영까지 동기화 */
  const applyServerPatch = useCallback(
    async (matchId: string, patch: Record<string, unknown>) => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket-matches/${matchId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string; message?: string }).error ||
            (data as { message?: string }).message ||
            "저장 실패");
          return;
        }
        setOverrides((o) => {
          const { [matchId]: _, ...rest } = o;
          return rest;
        });
        await load();
      } finally {
        setSaving(false);
      }
    },
    [tournamentId, load]
  );

  const resyncProgress = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket-matches/sync-progress`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string; message?: string }).error ||
          (data as { message?: string }).message ||
          "동기화 실패");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }, [tournamentId, load]);

  const phaseBlock =
    operationPhase && (
      <OperationsTournamentPhaseStepper
        steps={buildOperationPhaseSteps(tournamentId, operationPhase.snapshot, operationPhase.currentView)}
      />
    );

  if (loading && matches.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {phaseBlock}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">대진 데이터를 불러오는 중…</p>
      </div>
    );
  }

  if (!loading && matches.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {phaseBlock}
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          아직 생성된 본선/단판 Match가 없습니다. 먼저 대진 생성을 진행하세요.
        </p>
        <Link
          href={`/client/operations/tournaments/${tournamentId}/bracket-build`}
          className="inline-block rounded border border-zinc-400 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          대진 생성 콘솔
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {phaseBlock}
      <ConsolePageHeader
        eyebrow="운영 관리 · 대진"
        title="대진표 보기·수정"
        description={`「${tournamentName}」 — Match 데이터 직결. 카드 선택 후 우측에서 수정·저장합니다.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={listHref}
              className="rounded-sm border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-900 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              운영 목록
            </Link>
            <Link
              href={`/client/operations/tournaments/${tournamentId}/bracket-build`}
              className="rounded-sm border border-zinc-400 px-2.5 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              대진 생성
            </Link>
          </div>
        }
      />

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      {/* 상단 필터 */}
      <ConsoleSection title="필터" plain>
        <div className="flex flex-wrap items-end gap-3 text-[11px]">
          <div>
            <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">라운드</label>
            <select
              className="border border-zinc-400 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
            >
              <option value="all">전체</option>
              {roundOptions.map((r) => (
                <option key={r} value={String(r)}>
                  {r + 1}라운드
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">경기장</label>
            <select
              className="border border-zinc-400 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="unassigned">미배정</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.displayLabel}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="rounded border border-zinc-400 px-2 py-1 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            새로고침
          </button>
        </div>
      </ConsoleSection>

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[1fr_minmax(16rem,20rem)] lg:items-start">
        {/* 중앙 브래킷 */}
        <ConsoleSection title="라운드별 대진" flush className="min-h-[320px] overflow-hidden">
          <div className="flex min-h-[280px] gap-2 overflow-x-auto p-2">
            {roundColumns.map((ri) => (
              <div
                key={ri}
                className="flex w-[11.5rem] shrink-0 flex-col gap-1.5 border-r border-zinc-200 pr-2 dark:border-zinc-700"
              >
                <div className="sticky top-0 bg-zinc-100 py-1 text-center text-[11px] font-semibold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                  {ri + 1}R
                </div>
                {(byRound.get(ri) ?? []).map((m) => {
                  const active = selectedId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMatch(m.id)}
                      className={cx(
                        "w-full rounded border p-1.5 text-left text-[10px] leading-snug transition-colors",
                        active
                          ? "border-zinc-800 bg-zinc-200 dark:border-zinc-200 dark:bg-zinc-800"
                          : cx(
                              "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                              cardOutlineClass(m.status, active)
                            ),
                        m.hasIssue && "border-amber-500 ring-1 ring-amber-400/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[9px] text-zinc-500">#{m.matchIndex + 1}</span>
                        <span className={cx("rounded px-1 text-[9px] font-medium", statusBadgeClass(m.status))}>
                          {statusLabel(m.status)}
                        </span>
                      </div>
                      <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                        {m.entryALabel ?? "—"}
                      </div>
                      <div className="text-zinc-500">vs</div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">
                        {m.entryBLabel ?? "—"}
                      </div>
                      <div className={cx("mt-1 space-y-0.5 border-t border-zinc-200 pt-1 dark:border-zinc-700", consoleTextMuted)}>
                        <div>
                          부: {(m.divisionA || "—") + " / " + (m.divisionB || "—")}
                        </div>
                        <div>장: {m.venueLabel ?? "미배정"}</div>
                        <div>
                          시:{" "}
                          {m.scheduledStartAt
                            ? formatKoreanDateTime(m.scheduledStartAt)
                            : "미정"}
                        </div>
                      </div>
                      {m.hasIssue && (
                        <div className="mt-1 rounded bg-amber-100 px-1 text-[9px] text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">
                          문제 표시
                        </div>
                      )}
                      {m.status === "COMPLETED" &&
                        m.winnerEntryId &&
                        (m.scoreA != null || m.scoreB != null) && (
                          <div className="mt-1 font-mono text-[9px] text-zinc-600 dark:text-zinc-400">
                            {m.scoreA ?? "—"} : {m.scoreB ?? "—"}
                          </div>
                        )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ConsoleSection>

        {/* 우측 상세 */}
        <ConsoleSection title="선택 경기" flush>
          {!detail ? (
            <p className={cx("p-2 text-[11px]", consoleTextMuted)}>카드를 클릭하면 상세가 열립니다.</p>
          ) : (
            <div className="space-y-2 border-t border-zinc-200 p-2 text-[11px] dark:border-zinc-700">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="font-mono text-[10px] text-zinc-500">
                  {detail.roundIndex + 1}R · 경기 {detail.matchIndex + 1} · {detail.id.slice(0, 12)}…
                </p>
                <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold", statusBadgeClass(detail.status))}>
                  {statusLabel(detail.status)}
                </span>
              </div>

              {detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit && (
                <p className="rounded border border-amber-300 bg-amber-50 px-1.5 py-1 text-[10px] text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  정책상 완료 경기의 선수·점수·승자·상태는 수정할 수 없습니다. (bracketConfig.allowBracketCompletedResultEdit=false)
                </p>
              )}

              <div className="rounded border border-zinc-300 bg-zinc-50/80 p-2 dark:border-zinc-600 dark:bg-zinc-900/50">
                <p className="mb-1.5 text-[10px] font-semibold text-zinc-800 dark:text-zinc-100">경기 진행·결과</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={
                      saving ||
                      detail.status === "BYE" ||
                      detail.status === "COMPLETED" ||
                      detail.status === "IN_PROGRESS" ||
                      !detail.entryIdA ||
                      !detail.entryIdB
                    }
                    onClick={() => void applyServerPatch(detail.id, { status: "IN_PROGRESS" })}
                    className="rounded bg-sky-700 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    경기 시작
                  </button>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      detail.status === "BYE" ||
                      !detail.winnerEntryId ||
                      (detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit)
                    }
                    onClick={() =>
                      void applyServerPatch(detail.id, {
                        scoreA: detail.scoreA ?? 0,
                        scoreB: detail.scoreB ?? 0,
                        winnerEntryId: detail.winnerEntryId,
                      })
                    }
                    className="rounded bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40 hover:bg-emerald-800 dark:bg-emerald-600"
                  >
                    결과 확정
                  </button>
                </div>
                <p className={cx("mt-1 text-[9px]", consoleTextMuted)}>
                  시작: PENDING/READY → IN_PROGRESS · 확정: 승자+점수 저장 후 다음 경기로 자동 반영(READY 갱신)
                </p>
              </div>

              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">선수 1</label>
                <select
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                  value={detail.entryIdA ?? ""}
                  onChange={(e) => updateDetail({ entryIdA: e.target.value || null })}
                >
                  <option value="">(비움)</option>
                  {entries.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">선수 2</label>
                <select
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                  value={detail.entryIdB ?? ""}
                  onChange={(e) => updateDetail({ entryIdB: e.target.value || null })}
                >
                  <option value="">(비움)</option>
                  {entries.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                className="w-full rounded border border-zinc-500 py-1 text-[10px] text-zinc-800 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() =>
                  updateDetail({
                    entryIdA: detail.entryIdB,
                    entryIdB: detail.entryIdA,
                  })
                }
              >
                선수 교체 (A↔B)
              </button>

              <p className={cx("rounded bg-zinc-100 px-1.5 py-1 text-[10px] dark:bg-zinc-800", consoleTextMuted)}>
                부수(엔트리): {(detail.divisionA || "—") + " / " + (detail.divisionB || "—")}
              </p>

              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">경기장</label>
                <select
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  value={detail.matchVenueId ?? ""}
                  onChange={(e) => {
                    const vid = e.target.value || null;
                    const v = venues.find((x) => x.id === vid);
                    updateDetail({
                      matchVenueId: vid,
                      venueLabel: v?.displayLabel ?? null,
                    });
                  }}
                >
                  <option value="">미배정</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">예정 시각</label>
                <input
                  type="datetime-local"
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  value={toDatetimeLocalValue(detail.scheduledStartAt)}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateDetail({
                      scheduledStartAt: v ? new Date(v).toISOString() : null,
                    });
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="hasIssue"
                  type="checkbox"
                  checked={detail.hasIssue}
                  onChange={(e) => updateDetail({ hasIssue: e.target.checked })}
                />
                <label htmlFor="hasIssue" className="text-zinc-800 dark:text-zinc-200">
                  문제 경기 표시
                </label>
              </div>
              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">이슈 메모</label>
                <textarea
                  rows={2}
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  value={detail.issueNote ?? ""}
                  onChange={(e) => updateDetail({ issueNote: e.target.value || null })}
                  placeholder="현장 이슈, 재배정 필요 등"
                />
              </div>

              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="mb-0.5 block text-zinc-600 dark:text-zinc-400">점수 A</label>
                  <input
                    type="number"
                    min={0}
                    disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                    className="w-full border border-zinc-400 px-1 py-0.5 disabled:opacity-50"
                    value={detail.scoreA ?? ""}
                    onChange={(e) =>
                      updateDetail({ scoreA: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-zinc-600 dark:text-zinc-400">점수 B</label>
                  <input
                    type="number"
                    min={0}
                    disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                    className="w-full border border-zinc-400 px-1 py-0.5 disabled:opacity-50"
                    value={detail.scoreB ?? ""}
                    onChange={(e) =>
                      updateDetail({ scoreB: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">상태</label>
                <select
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 disabled:opacity-50 dark:bg-zinc-950"
                  disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                  value={detail.status}
                  onChange={(e) => updateDetail({ status: e.target.value })}
                >
                  <option value="PENDING">대기</option>
                  <option value="READY">준비</option>
                  <option value="BYE">부전</option>
                  <option value="IN_PROGRESS">진행</option>
                  <option value="COMPLETED">완료</option>
                </select>
              </div>

              <div>
                <label className="mb-0.5 block font-medium text-zinc-600 dark:text-zinc-400">승자 엔트리</label>
                <select
                  className="w-full border border-zinc-400 bg-white px-1.5 py-1 disabled:opacity-50 dark:bg-zinc-950"
                  disabled={detail.status === "COMPLETED" && !bracketOpsPolicy.allowBracketCompletedResultEdit}
                  value={detail.winnerEntryId ?? ""}
                  onChange={(e) => updateDetail({ winnerEntryId: e.target.value || null })}
                >
                  <option value="">(없음)</option>
                  {detail.entryIdA && (
                    <option value={detail.entryIdA}>슬롯1 ({entryLabel(detail.entryIdA)})</option>
                  )}
                  {detail.entryIdB && (
                    <option value={detail.entryIdB}>슬롯2 ({entryLabel(detail.entryIdB)})</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                disabled={saving || !detailDirty}
                onClick={() => saveMatch(detail.id)}
                className="w-full rounded bg-zinc-800 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
              >
                이 경기 저장
              </button>
            </div>
          )}
        </ConsoleSection>
      </div>

      {autoSortOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg border border-zinc-300 bg-white p-3 text-[11px] shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
            <p className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">예정 시각 자동 배치</p>
            <p className={cx("mb-2", consoleTextMuted)}>
              라운드 순으로 경기마다 간격을 두고 scheduledStartAt을 채웁니다.
            </p>
            <label className="mb-1 block text-zinc-700 dark:text-zinc-300">시작 시각</label>
            <input
              type="datetime-local"
              className="mb-2 w-full border border-zinc-400 px-1 py-0.5 dark:bg-zinc-950"
              value={autoBase}
              onChange={(e) => setAutoBase(e.target.value)}
            />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-zinc-600 dark:text-zinc-400">간격(분)</label>
                <input
                  type="number"
                  min={5}
                  className="w-full border border-zinc-400 px-1 py-0.5"
                  value={autoInterval}
                  onChange={(e) => setAutoInterval(e.target.value)}
                />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400">라운드 간(분)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-zinc-400 px-1 py-0.5"
                  value={autoRoundGap}
                  onChange={(e) => setAutoRoundGap(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-zinc-400 px-2 py-1"
                onClick={() => setAutoSortOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded bg-zinc-800 px-2 py-1 text-white dark:bg-zinc-200 dark:text-zinc-900"
                onClick={() => void runAutoSort()}
              >
                실행
              </button>
            </div>
          </div>
        </div>
      )}

      <ConsoleActionBar
        sticky
        className="mt-auto"
        left={
          <span className={cx(consoleTextMuted, "text-[11px]")}>
            미저장 {dirtyIds.length}건
            {tournamentStartAt && (
              <>
                {" "}
                · 대회 시작 {formatKoreanDateTime(tournamentStartAt)}
              </>
            )}
          </span>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAll()}
              className="rounded-sm border border-zinc-600 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              전체 저장
            </button>
            <button
              type="button"
              disabled={saving || dirtyIds.length > 0}
              onClick={() => {
                void load().then(() => setError(""));
              }}
              className="rounded-sm border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40 dark:border-emerald-600 dark:bg-emerald-800"
              title="미저장 변경이 없을 때만 확정(동기화)할 수 있습니다."
            >
              확정·동기화
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={openAutoSort}
              className="rounded-sm border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              자동 정렬(시간)
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void resyncProgress()}
              className="rounded-sm border border-violet-600 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-500 dark:text-violet-100 dark:hover:bg-violet-950/40"
            >
              진행·부전 재동기화
            </button>
          </div>
        }
      />
    </div>
  );
}
