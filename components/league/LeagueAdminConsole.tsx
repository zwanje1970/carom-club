"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeagueDetailView, LeagueSummary } from "@/lib/league-view";
import { LeagueEntryStatusBadge, LeagueKindLabel, LeagueStandingsTable, LeagueStatusBadge } from "./LeagueTables";

type TabId = "matches" | "standings";

type ZoneOption = {
  id: string;
  name: string;
  code: string | null;
};

export function LeagueAdminConsole({
  tournamentId,
  initialLeagues,
  zones,
  initialLeague,
}: {
  tournamentId: string;
  initialLeagues: LeagueSummary[];
  zones: ZoneOption[];
  initialLeague: LeagueDetailView | null;
}) {
  const [leagues, setLeagues] = useState(initialLeagues);
  const [selectedLeagueId, setSelectedLeagueId] = useState(initialLeague?.id ?? initialLeagues[0]?.id ?? "");
  const [selectedLeague, setSelectedLeague] = useState<LeagueDetailView | null>(initialLeague);
  const [tab, setTab] = useState<TabId>("matches");
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<"MAIN" | "ZONE" | "FINAL">("MAIN");
  const [createZoneId, setCreateZoneId] = useState(zones[0]?.id ?? "");
  const [createPointsForWin, setCreatePointsForWin] = useState(3);
  const [createPointsForDraw, setCreatePointsForDraw] = useState(1);
  const [createPointsForLoss, setCreatePointsForLoss] = useState(0);
  const [createTieBreaker, setCreateTieBreaker] = useState<LeagueSummary["tieBreaker"]>("HEAD_TO_HEAD");
  const isSelectedLeagueClosed = selectedLeague?.status === "COMPLETED";

  useEffect(() => {
    void reloadLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedLeagueId) return;
    if (selectedLeague?.id === selectedLeagueId) return;
    void loadLeague(selectedLeagueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshLeagueData();
    }, 30000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, selectedLeagueId]);

  async function reloadLeagues() {
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/leagues`, { credentials: "include" });
      const json = (await res.json()) as { leagues?: LeagueSummary[]; error?: string };
      if (!res.ok || !json.leagues) return;
      setLeagues(json.leagues);
      if (!selectedLeagueId && json.leagues[0]?.id) {
        setSelectedLeagueId(json.leagues[0].id);
      }
    } catch {
      // ignore
    }
  }

  async function refreshLeagueData() {
    await reloadLeagues();
    if (selectedLeagueId) {
      await loadLeague(selectedLeagueId);
    }
    setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  async function loadLeague(leagueId: string) {
    setLoadingLeague(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/leagues/${leagueId}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { league?: LeagueDetailView; error?: string };
      if (!res.ok || !json.league) {
        setMessage(json.error || "리그를 불러오지 못했습니다.");
        return;
      }
      setSelectedLeague(json.league);
      setSelectedLeagueId(json.league.id);
      setMessage(null);
      setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setLoadingLeague(false);
    }
  }

  async function createLeague() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/leagues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: createKind,
          zoneId: createKind === "ZONE" ? createZoneId : null,
          pointsForWin: createPointsForWin,
          pointsForDraw: createPointsForDraw,
          pointsForLoss: createPointsForLoss,
          tieBreaker: createTieBreaker,
        }),
      });
      const json = (await res.json()) as { league?: LeagueDetailView; error?: string };
      if (!res.ok || !json.league) {
        setMessage(json.error || "리그를 생성하지 못했습니다.");
        return;
      }
      await reloadLeagues();
      setSelectedLeague(json.league);
      setSelectedLeagueId(json.league.id);
      setTab("matches");
      setMessage("리그를 생성했습니다.");
      setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setSaving(false);
    }
  }

  async function saveMatch(matchId: string, scoreA: number, scoreB: number, winnerLeagueEntryId: string | null) {
    if (!selectedLeague) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/leagues/${selectedLeague.id}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scoreA,
          scoreB,
          winnerLeagueEntryId,
          status: "COMPLETED",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error || "경기 결과 저장에 실패했습니다.");
        return;
      }
      await loadLeague(selectedLeague.id);
      await reloadLeagues();
      setMessage("경기 결과를 저장했습니다.");
      setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setSaving(false);
    }
  }

  async function recalculateStandings() {
    if (!selectedLeague) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/leagues/${selectedLeague.id}/standings/recalculate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error || "순위 재계산에 실패했습니다.");
        return;
      }
      await loadLeague(selectedLeague.id);
      await reloadLeagues();
      setMessage("순위를 다시 계산했습니다.");
      setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setSaving(false);
    }
  }

  async function forceCompleteLeague() {
    if (!selectedLeague) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/leagues/${selectedLeague.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reason: "관리자 강제 종료",
          }),
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(json.error || "리그 강제 종료에 실패했습니다.");
        return;
      }
      await loadLeague(selectedLeague.id);
      await reloadLeagues();
      setMessage("리그를 종료하고 미경기를 0점 처리했습니다.");
      setLastSyncedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } finally {
      setSaving(false);
    }
  }

  const entriesById = useMemo(() => {
    if (!selectedLeague) return {};
    return Object.fromEntries(selectedLeague.entries.map((entry) => [entry.id, entry.displayName]));
  }, [selectedLeague]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-site-border bg-site-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-gray-500">리그 생성</p>
            <h2 className="text-xl font-semibold text-site-text">LeagueEntry 기준 리그 관리</h2>
            <p className="mt-1 text-xs text-gray-500">
              자동 새로고침 30초 · 마지막 동기화 {lastSyncedAt ?? "없음"}
            </p>
          </div>
          <button
            type="button"
            onClick={createLeague}
            disabled={saving}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "처리 중..." : "리그 생성 / 재생성"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-gray-500">리그 종류</span>
            <select
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value as "MAIN" | "ZONE" | "FINAL")}
              className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2"
            >
              <option value="MAIN">MAIN</option>
              <option value="ZONE">ZONE</option>
              <option value="FINAL">FINAL</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-500">권역</span>
            <select
              value={createZoneId}
              onChange={(e) => setCreateZoneId(e.target.value)}
              disabled={createKind !== "ZONE"}
              className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2 disabled:opacity-50"
            >
              <option value="">선택 안함</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-500">승점</span>
            <input
              type="number"
              value={createPointsForWin}
              onChange={(e) => setCreatePointsForWin(Number(e.target.value))}
              className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-500">무승부 / 패배</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={createPointsForDraw}
                onChange={(e) => setCreatePointsForDraw(Number(e.target.value))}
                className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2"
              />
              <input
                type="number"
                value={createPointsForLoss}
                onChange={(e) => setCreatePointsForLoss(Number(e.target.value))}
                className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-gray-500">타이브레이커</span>
            <select
              value={createTieBreaker}
              onChange={(e) => setCreateTieBreaker(e.target.value as LeagueSummary["tieBreaker"])}
              className="w-full rounded-lg border border-site-border bg-site-bg px-3 py-2"
            >
              <option value="HEAD_TO_HEAD">HEAD_TO_HEAD</option>
              <option value="SCORE_DIFF">SCORE_DIFF</option>
              <option value="SCORE_FOR">SCORE_FOR</option>
              <option value="DRAW_COUNT">DRAW_COUNT</option>
            </select>
          </label>
          <div className="rounded-lg border border-site-border bg-site-bg p-3 text-xs text-gray-500">
            승인된 참가자는 자동으로 `LeagueEntry`에 등록되고, 생성 시 라운드/매치/순위표가 다시 구성됩니다.
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {leagues.length === 0 ? (
          <div className="rounded-xl border border-site-border bg-site-card p-4 text-sm text-gray-500 md:col-span-2 xl:col-span-3">
            아직 생성된 리그가 없습니다.
          </div>
        ) : (
          leagues.map((league) => (
            <button
              key={league.id}
              type="button"
              onClick={() => setSelectedLeagueId(league.id)}
              className={`rounded-xl border p-4 text-left transition ${
                league.id === selectedLeagueId
                  ? "border-site-primary bg-site-primary/5"
                  : "border-site-border bg-site-card hover:border-site-primary/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-gray-500">{LeagueKindLabel(league.kind)}</div>
                  <div className="text-lg font-semibold text-site-text">
                    {league.zoneId ? zones.find((zone) => zone.id === league.zoneId)?.name ?? "권역" : "전체 리그"}
                  </div>
                </div>
                <LeagueStatusBadge status={league.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>참가자 {league.counts.entries}</div>
                <div>경기 {league.counts.matches}</div>
                <div>라운드 {league.counts.rounds}</div>
                <div>순위 {league.counts.standings}</div>
              </div>
            </button>
          ))
        )}
      </section>

      {selectedLeague && (
        <section className="space-y-4 rounded-xl border border-site-border bg-site-card p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">선택 리그</p>
              <h3 className="text-xl font-semibold text-site-text">
                {LeagueKindLabel(selectedLeague.kind)} · {selectedLeague.zoneId ? zones.find((zone) => zone.id === selectedLeague.zoneId)?.name ?? "권역" : "전체"}
              </h3>
            {selectedLeague.completedAt && (
              <p className="mt-1 text-xs text-gray-500">
                종료 시각 {new Date(selectedLeague.completedAt).toLocaleString("ko-KR")}
              </p>
            )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadLeague(selectedLeague.id)}
                className="rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-site-bg"
              >
                새로고침
              </button>
              <button
                type="button"
                onClick={() => void recalculateStandings()}
              disabled={saving || isSelectedLeagueClosed}
                className="rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-site-bg"
              >
                순위 재계산
              </button>
              <button
                type="button"
                onClick={() => void forceCompleteLeague()}
                disabled={saving || isSelectedLeagueClosed}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSelectedLeagueClosed ? "종료 완료" : "강제 종료"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="상태" value={<LeagueStatusBadge status={selectedLeague.status} />} />
            <SummaryCard label="참가자" value={String(selectedLeague.entries.length)} />
            <SummaryCard label="경기" value={String(selectedLeague.matches.length)} />
            <SummaryCard label="순위" value={String(selectedLeague.standings.length)} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard
              label="활성"
              value={String(selectedLeague.entries.filter((entry) => entry.status === "ACTIVE").length)}
            />
            <SummaryCard
              label="자동 등록"
              value={String(selectedLeague.entries.filter((entry) => entry.isAutoRegistered).length)}
            />
            <SummaryCard
              label="제외"
              value={String(selectedLeague.entries.filter((entry) => entry.status === "WITHDRAWN").length)}
            />
            <SummaryCard
              label="자동 제외"
              value={String(selectedLeague.entries.filter((entry) => entry.status === "EXCLUDED").length)}
            />
          </div>

          <section className="space-y-3 rounded-xl border border-site-border bg-site-bg p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-base font-semibold text-site-text">참가자 상태</h4>
              <span className="text-xs text-gray-500">자동 등록 / 제외 상태를 함께 표시합니다</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-site-border bg-site-card">
              <table className="min-w-full divide-y divide-site-border text-sm">
                <thead className="bg-site-bg">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">이름</th>
                    <th className="px-4 py-3 font-medium">등급</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">등록</th>
                    <th className="px-4 py-3 font-medium">시드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-site-border">
                  {selectedLeague.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 font-medium text-site-text">{entry.displayName}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.levelCode ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <LeagueEntryStatusBadge status={entry.status} />
                          {entry.isAutoRegistered && (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                              자동
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{new Date(entry.registeredAt).toLocaleString("ko-KR")}</div>
                        {entry.withdrawnAt && (
                          <div className="text-xs text-gray-500">제외: {new Date(entry.withdrawnAt).toLocaleString("ko-KR")}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{entry.seedNumber ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("matches")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === "matches"
                  ? "bg-site-primary text-white"
                  : "border border-site-border text-gray-600 hover:bg-site-bg"
              }`}
            >
              경기표
            </button>
            <button
              type="button"
              onClick={() => setTab("standings")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                tab === "standings"
                  ? "bg-site-primary text-white"
                  : "border border-site-border text-gray-600 hover:bg-site-bg"
              }`}
            >
              순위표
            </button>
          </div>

          {message && <p className="rounded-lg bg-site-bg px-3 py-2 text-sm text-site-primary">{message}</p>}
          {loadingLeague && <p className="text-sm text-gray-500">리그를 불러오는 중…</p>}
          {isSelectedLeagueClosed && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              종료된 리그는 경기 결과 수정이 잠겨 있습니다.
            </p>
          )}

          {tab === "matches" ? (
            <LeagueAdminMatchesEditor
              league={selectedLeague}
              entriesById={entriesById}
              onSave={saveMatch}
              saving={saving}
              locked={isSelectedLeagueClosed}
            />
          ) : (
            <LeagueStandingsTable standings={selectedLeague.standings} />
          )}
        </section>
      )}
    </div>
  );
}

function LeagueAdminMatchesEditor({
  league,
  entriesById,
  onSave,
  saving,
  locked,
}: {
  league: LeagueDetailView;
  entriesById: Record<string, string>;
  onSave: (matchId: string, scoreA: number, scoreB: number, winnerLeagueEntryId: string | null) => Promise<void>;
  saving: boolean;
  locked: boolean;
}) {
  const [scores, setScores] = useState<Record<string, { scoreA: string; scoreB: string; winnerLeagueEntryId: string }>>({});

  useEffect(() => {
    const next: Record<string, { scoreA: string; scoreB: string; winnerLeagueEntryId: string }> = {};
    for (const match of league.matches) {
      next[match.id] = {
        scoreA: match.scoreA != null ? String(match.scoreA) : "",
        scoreB: match.scoreB != null ? String(match.scoreB) : "",
        winnerLeagueEntryId: match.winnerLeagueEntryId ?? "",
      };
    }
    setScores(next);
  }, [league]);

  if (league.matches.length === 0) {
    return <p className="rounded-xl border border-site-border bg-site-bg p-4 text-sm text-gray-500">경기가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {league.rounds.map((round) => (
        <div key={round.id} className="space-y-2">
          <h4 className="text-base font-semibold text-site-text">{round.name}</h4>
          <div className="space-y-2">
            {round.matches.map((match) => {
              const row = scores[match.id] ?? {
                scoreA: "",
                scoreB: "",
                winnerLeagueEntryId: "",
              };
              const a = match.leagueEntryA?.displayName ?? entriesById[match.leagueEntryIdA ?? ""] ?? "—";
              const b = match.leagueEntryB?.displayName ?? entriesById[match.leagueEntryIdB ?? ""] ?? "—";
              return (
                <div key={match.id} className="rounded-xl border border-site-border bg-site-bg p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-site-text">#{match.matchNumber + 1}</div>
                    <div className="flex flex-wrap gap-2">
                      {match.isWalkover && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">부전승</span>}
                      {match.isManualOverride && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">수동</span>}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <div className="text-xs text-gray-500">A</div>
                      <div className="font-medium text-site-text">{a}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">B</div>
                      <div className="font-medium text-site-text">{b}</div>
                    </div>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-500">점수</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={row.scoreA}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [match.id]: { ...row, scoreA: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-site-border bg-site-card px-3 py-2"
                        />
                        <input
                          type="number"
                          value={row.scoreB}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [match.id]: { ...row, scoreB: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-site-border bg-site-card px-3 py-2"
                        />
                      </div>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-500">승자</span>
                      <select
                        value={row.winnerLeagueEntryId}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [match.id]: { ...row, winnerLeagueEntryId: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-site-border bg-site-card px-3 py-2"
                      >
                        <option value="">자동 계산</option>
                        {match.leagueEntryA && <option value={match.leagueEntryA.id}>{match.leagueEntryA.displayName}</option>}
                        {match.leagueEntryB && <option value={match.leagueEntryB.id}>{match.leagueEntryB.displayName}</option>}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={saving || locked}
                      onClick={() =>
                        void onSave(
                          match.id,
                          Number(row.scoreA || 0),
                          Number(row.scoreB || 0),
                          row.winnerLeagueEntryId || null
                        )
                      }
                      className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {locked ? "종료됨" : "저장"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-site-border bg-site-bg p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-site-text">{value}</div>
    </div>
  );
}
