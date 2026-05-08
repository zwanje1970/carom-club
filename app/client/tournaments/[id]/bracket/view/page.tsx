"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getSliceRoundsFromBracket,
  hasDownstreamRoundsInSlice,
  shuffleScopeForSlice,
  syncClearMatchWinner,
  syncRenamePlayer,
  syncSwapPlayers,
  syncWinnerPick,
  type BracketLike,
  type MutationFns,
} from "../bracket-view-server-sync";
import viewStyles from "../bracket-view-page.module.css";
import { applyCaromOrientationMode } from "../../../../native-fullscreen-orientation-lock";

const InteractiveBracketBoard = dynamic(
  () => import("../InteractiveBracketBoard"),
  { ssr: false, loading: () => <p className="v3-muted">인터랙티브 대진표 보드를 불러오는 중…</p> },
);

type BracketRoundView = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: Array<{
    id: string;
    player1: { userId: string; name: string; displayName?: string | null };
    player2: { userId: string; name: string; displayName?: string | null };
    winnerUserId: string | null;
    winnerName: string | null;
    status: "PENDING" | "COMPLETED";
  }>;
};

type Bracket = {
  id: string;
  tournamentId: string;
  zoneId?: string | null;
  rounds: BracketRoundView[];
  createdAt: string;
  bracketMode?: "single" | "multi_block";
  blocks?: Array<{ id: string; label?: string; rounds: BracketRoundView[] }>;
  finalBlock?: { rounds: BracketRoundView[] };
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TournamentBracketBoardViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);

  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [isTournamentClosed, setIsTournamentClosed] = useState(false);
  const [tournamentTitle, setTournamentTitle] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentLocation, setTournamentLocation] = useState("");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [message, setMessage] = useState("");
  const [boardSliceKey, setBoardSliceKey] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [boardRemountKey, setBoardRemountKey] = useState(0);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const loadBracket = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      return;
    }
    try {
      const url = zonesEnabled
        ? `/api/client/tournaments/${tournamentId}/bracket/zones/${encodeURIComponent(selectedZoneId)}`
        : `/api/client/tournaments/${tournamentId}/bracket`;
      const response = await fetch(url, { credentials: "same-origin" });
      const result = (await response.json()) as { bracket?: Bracket | null; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "대진표 조회에 실패했습니다.");
        return;
      }
      setBracket(result.bracket ?? null);
      setMessage("");
    } catch {
      setMessage("대진표 조회 중 오류가 발생했습니다.");
    }
  }, [selectedZoneId, tournamentId, zonesEnabled]);

  const mutationFns = useMemo<MutationFns>(() => {
    return {
      patchMatchResult: async (matchId, winnerUserId) => {
        const response = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/result${bracketZoneQuery}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ winnerUserId }),
          },
        );
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "경기 결과 저장에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
      advanceRound: async (roundNumber, sliceKey) => {
        const response = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/rounds/${roundNumber}/advance${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(sliceKey ? { sliceKey } : {}),
          },
        );
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "다음 라운드 생성에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
      resetAfter: async (roundNumber, sliceKey) => {
        const response = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/rounds/${roundNumber}/reset-after${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(sliceKey ? { sliceKey } : {}),
          },
        );
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "이후 라운드 초기화에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
      rebuildFromRound: async (roundNumber, sliceKey) => {
        const response = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/rebuild-from-round${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              roundNumber,
              allowPartial: true,
              ...(sliceKey ? { sliceKey } : {}),
            }),
          },
        );
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "브래킷 재계산에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
      reassign: async (roundNumber, operations, sliceKey) => {
        const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/matches/reassign${bracketZoneQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            roundNumber,
            operations,
            autoRebuildAfter: false,
            allowPartialRebuild: true,
            ...(sliceKey ? { sliceKey } : {}),
          }),
        });
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "선수 위치 교체에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
      renamePlayer: async (matchId, slot, displayName) => {
        const response = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/player${bracketZoneQuery}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ slot, displayName }),
          },
        );
        const result = (await response.json()) as { bracket?: Bracket; error?: string };
        if (!response.ok || !result.bracket) {
          return { ok: false as const, error: result.error ?? "선수 이름 수정에 실패했습니다." };
        }
        return { ok: true as const, bracket: result.bracket as BracketLike };
      },
    };
  }, [bracketZoneQuery, tournamentId]);

  const hasDownstream = useCallback((b: BracketLike, roundNumber: number, sliceKey: string | null) => {
    return hasDownstreamRoundsInSlice(getSliceRoundsFromBracket(b, sliceKey), roundNumber);
  }, []);

  const handleExit = useCallback(() => {
    if (!tournamentId) return;
    router.replace(`/client/tournaments/${tournamentId}`);
  }, [router, tournamentId]);

  const handlePickWinner = useCallback(
    async (args: { matchId: string; winnerUserId: string; roundNumber: number }) => {
      if (!bracket || !tournamentId || isTournamentClosed || actionBusy) return;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        const rs = await syncWinnerPick({
          bracket: bracket as BracketLike,
          matchId: args.matchId,
          winnerUserId: args.winnerUserId,
          roundNumber: args.roundNumber,
          mut: mutationFns,
          hasDownstream,
        });
        if (!rs.ok) {
          setSaveState("error");
          setMessage(rs.error);
          return;
        }
        setBracket(rs.bracket as Bracket);
        setBoardRemountKey((k) => k + 1);
        setSaveState("saved");
        setMessage(rs.message);
      } catch {
        setSaveState("error");
        setMessage("경기 결과 저장 중 오류가 발생했습니다.");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, tournamentId],
  );

  const handleSwapPlayers = useCallback(
    async (args: {
      roundNumber: number;
      first: { matchId: string; slot: "player1" | "player2" };
      second: { matchId: string; slot: "player1" | "player2" };
    }) => {
      if (!bracket || actionBusy || isTournamentClosed) return;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        const rs = await syncSwapPlayers({
          bracket: bracket as BracketLike,
          roundNumber: args.roundNumber,
          first: args.first,
          second: args.second,
          mut: mutationFns,
          hasDownstream,
        });
        if (!rs.ok) {
          setSaveState("error");
          setMessage(rs.error);
          return;
        }
        setBracket(rs.bracket as Bracket);
        setBoardRemountKey((k) => k + 1);
        setSaveState("saved");
        setMessage("선수 위치가 교체되었습니다.");
      } catch {
        setSaveState("error");
        setMessage("선수 위치 교체 중 오류가 발생했습니다.");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns],
  );

  const handleRenamePlayer = useCallback(
    async (args: { roundNumber: number; matchId: string; slot: "player1" | "player2"; displayName: string }) => {
      if (!bracket || actionBusy || isTournamentClosed) return;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        const rs = await syncRenamePlayer({
          bracket: bracket as BracketLike,
          roundNumber: args.roundNumber,
          matchId: args.matchId,
          slot: args.slot,
          displayName: args.displayName,
          mut: mutationFns,
          hasDownstream,
        });
        if (!rs.ok) {
          setSaveState("error");
          setMessage(rs.error);
          return;
        }
        setBracket(rs.bracket as Bracket);
        setBoardRemountKey((k) => k + 1);
        setSaveState("saved");
        setMessage("선수 이름이 수정되었습니다.");
      } catch {
        setSaveState("error");
        setMessage("선수 이름 수정 중 오류가 발생했습니다.");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns],
  );

  const handleClearMatchWinner = useCallback(
    async (args: { matchId: string }) => {
      if (!bracket || !tournamentId || isTournamentClosed || actionBusy) return;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        const rs = await syncClearMatchWinner({
          bracket: bracket as BracketLike,
          matchId: args.matchId,
          mut: mutationFns,
          hasDownstream,
        });
        if (!rs.ok) {
          setSaveState("error");
          setMessage(rs.error);
          return;
        }
        setBracket(rs.bracket as Bracket);
        setBoardRemountKey((k) => k + 1);
        setSaveState("saved");
        setMessage(rs.message);
      } catch {
        setSaveState("error");
        setMessage("진출 취소 중 오류가 발생했습니다.");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, tournamentId],
  );

  const handleShuffleRound = useCallback(
    async (roundNumber: number) => {
      if (!bracket || actionBusy || isTournamentClosed || !tournamentId) return;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        const res = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/shuffle-round-one${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              scope: shuffleScopeForSlice(bracket as BracketLike, boardSliceKey),
              roundNumber,
            }),
          },
        );
        const json = (await res.json()) as { bracket?: Bracket; error?: string };
        if (!res.ok || !json.bracket) {
          setSaveState("error");
          setMessage(json.error ?? "라운드 재배치에 실패했습니다.");
          return;
        }
        setBracket(json.bracket);
        setBoardRemountKey((k) => k + 1);
        setSaveState("saved");
        setMessage(`Round ${roundNumber}이(가) 재배치되었습니다.`);
      } catch {
        setSaveState("error");
        setMessage("현재 라운드 재배치 중 오류가 발생했습니다.");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, boardSliceKey, bracket, bracketZoneQuery, isTournamentClosed, tournamentId],
  );

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`, { credentials: "same-origin" });
        const json = (await res.json()) as {
          tournament?: {
            zonesEnabled?: boolean;
            statusBadge?: string | null;
            title?: string;
            date?: string;
            location?: string;
          };
        };
        if (!res.ok || cancelled || !json.tournament) return;
        setZonesEnabled(json.tournament.zonesEnabled === true);
        setIsTournamentClosed((json.tournament.statusBadge ?? "") === "종료");
        setTournamentTitle((json.tournament.title ?? "").trim());
        setTournamentDate((json.tournament.date ?? "").trim());
        setTournamentLocation((json.tournament.location ?? "").trim());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || !zonesEnabled) {
      setZoneOptions([]);
      if (!zonesEnabled) setSelectedZoneId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}/zones`, { credentials: "same-origin" });
        const json = (await res.json()) as { zones?: Array<{ id?: string; zoneName?: string; status?: string }> };
        if (!res.ok || cancelled || !Array.isArray(json.zones)) return;
        const opts: { id: string; zoneName: string }[] = [];
        for (const z of json.zones) {
          if (!z || z.status !== "ACTIVE") continue;
          const id = typeof z.id === "string" ? z.id.trim() : "";
          const zoneName = typeof z.zoneName === "string" ? z.zoneName.trim() : "";
          if (id && zoneName) opts.push({ id, zoneName });
        }
        setZoneOptions(opts);
        setSelectedZoneId((prev) => {
          if (urlZoneId && opts.some((o) => o.id === urlZoneId)) return urlZoneId;
          if (prev && opts.some((o) => o.id === prev)) return prev;
          return opts[0]?.id ?? "";
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, zonesEnabled, urlZoneId]);

  useEffect(() => {
    void loadBracket();
  }, [loadBracket]);

  useEffect(() => {
    return () => {
      applyCaromOrientationMode("portrait", "bracket-view-fullscreen:unmount");
    };
  }, []);

  useEffect(() => {
    if (!bracket) {
      setBoardSliceKey(null);
      return;
    }
    if (bracket.bracketMode === "multi_block" && bracket.blocks?.[0]) {
      setBoardSliceKey(`block:${bracket.blocks[0].id}`);
    } else {
      setBoardSliceKey(null);
    }
  }, [bracket?.id, bracket?.bracketMode, bracket?.blocks]);

  const boardBracket = useMemo(() => {
    if (!bracket) return null;
    let rounds: BracketRoundView[];
    if (bracket.bracketMode === "multi_block" && boardSliceKey) {
      if (boardSliceKey === "final") {
        rounds = bracket.finalBlock?.rounds ?? [];
      } else if (boardSliceKey.startsWith("block:")) {
        const bid = boardSliceKey.slice("block:".length);
        rounds = bracket.blocks?.find((b) => b.id === bid)?.rounds ?? [];
      } else {
        rounds = [];
      }
    } else {
      rounds = bracket.rounds;
    }
    const suffix = boardSliceKey ?? "root";
    return { id: `${bracket.id}:${suffix}`, rounds };
  }, [bracket, boardSliceKey]);

  const saveStateText =
    saveState === "saving" ? "저장 중..." : saveState === "saved" ? "저장됨" : saveState === "error" ? "오류 발생" : "";

  const renderBracketContextControls = () => (
    <>
      {zonesEnabled ? (
        <select
          className="v3-btn"
          value={selectedZoneId}
          onChange={(e) => setSelectedZoneId(e.target.value)}
          disabled={zoneOptions.length === 0}
          style={{ minHeight: 34, fontWeight: 600 }}
        >
          {zoneOptions.length === 0 ? <option value="">권역 없음</option> : null}
          {zoneOptions.map((z) => (
            <option key={z.id} value={z.id}>
              {z.zoneName}
            </option>
          ))}
        </select>
      ) : null}
      {message ? <span className={`v3-muted ${viewStyles.pageHeaderMessage}`}>{message}</span> : null}
    </>
  );

  const bracketViewSlicePicker =
    bracket?.bracketMode === "multi_block" && bracket.blocks?.length
      ? {
          blocks: bracket.blocks.map((bl) => ({ id: bl.id, label: bl.label })),
          hasFinal: Boolean(bracket.finalBlock?.rounds?.length),
          boardSliceKey,
          onSliceChange: setBoardSliceKey,
        }
      : null;

  const bracketViewZones = zonesEnabled
    ? {
        options: zoneOptions,
        selectedId: selectedZoneId,
        onChange: setSelectedZoneId,
      }
    : null;

  return (
    <main
      className={viewStyles.bracketViewMain}
      data-client-bracket-view-fullscreen="1"
      style={{
        position: "fixed",
        inset: 0,
        boxSizing: "border-box",
        width: "100%",
        height: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: "#f8fafc",
        overscrollBehavior: "none",
      }}
    >
      <header
        className={viewStyles.pageHeader}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(148,163,184,0.35)",
          paddingTop: "0.45rem",
          paddingRight: "0.55rem",
          paddingBottom: "0.6rem",
          paddingLeft: "0.55rem",
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          flexWrap: "wrap",
        }}
      >
        <div className={viewStyles.pageHeaderNavChrome} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <button
            type="button"
            className="v3-btn"
            onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket${bracketZoneQuery}`)}
          >
            ← 돌아가기
          </button>
          <strong style={{ fontSize: "0.92rem" }}>대진표 보기</strong>
        </div>
        {renderBracketContextControls()}
      </header>

      <section
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        {zonesEnabled && !selectedZoneId ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#e2e8f0",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            <p>권역을 선택해야 대진표를 볼 수 있습니다.</p>
          </div>
        ) : !bracket ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#e2e8f0",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            <p>아직 확정된 대진표가 없습니다.</p>
          </div>
        ) : boardBracket ? (
          <InteractiveBracketBoard
            key={`${boardBracket.id}-${boardRemountKey}`}
            bracket={boardBracket}
            tournamentTitle={tournamentTitle}
            tournamentDate={tournamentDate}
            tournamentLocation={tournamentLocation}
            interactionDisabled={isTournamentClosed}
            actionBusy={actionBusy}
            canUndo={false}
            saveStateText={saveStateText}
            chromeMode="bracketView"
            bracketViewSlicePicker={bracketViewSlicePicker}
            bracketViewZones={bracketViewZones}
            bracketViewNotice={message}
            onExit={handleExit}
            onPickWinner={handlePickWinner}
            onClearMatchWinner={handleClearMatchWinner}
            onSwapPlayers={handleSwapPlayers}
            onRenamePlayer={handleRenamePlayer}
            onShuffleRound={(roundNumber) => {
              void handleShuffleRound(roundNumber);
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
