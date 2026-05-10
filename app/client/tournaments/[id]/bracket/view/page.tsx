"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  findBracketMatchLocation,
  getSliceRoundsFromBracket,
  hasDownstreamRoundsInSlice,
  isEligibleBracketWinnerUserId,
  shuffleScopeForSlice,
  syncClearMatchWinner,
  syncRenamePlayer,
  syncSwapPlayers,
  syncWinnerPick,
  type BracketLike,
  type MutationFns,
} from "../bracket-view-server-sync";
import {
  appendOfflinePending,
  applyLocalClearWinner,
  applyLocalRenamePlayer,
  applyLocalSwapPlayers,
  applyLocalWinnerPick,
  bracketOfflineSegment,
  readLastGoodBracket,
  readOfflineDirty,
  readOfflinePending,
  replayShuffleRoundFetch,
  setOfflineDirty,
  writeLastGoodBracket,
  writeOfflinePending,
} from "../bracket-offline-cache";
import viewStyles from "../bracket-view-page.module.css";
import {
  applyCaromOrientationMode,
  CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID,
  unregisterCaromExplicitNativeLandscapeSession,
} from "../../../../native-fullscreen-orientation-lock";

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
  const sliceMetaRef = useRef<{ bracketId: string; blockSig: string }>({ bracketId: "", blockSig: "" });
  const bracketRef = useRef<Bracket | null>(null);
  const replayRunningRef = useRef(false);
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [bracketSyncBusy, setBracketSyncBusy] = useState(false);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const storageSeg = useMemo(() => bracketOfflineSegment(zonesEnabled, selectedZoneId), [zonesEnabled, selectedZoneId]);

  useEffect(() => {
    bracketRef.current = bracket;
  }, [bracket]);

  useEffect(() => {
    const up = () => setNavigatorOnline(true);
    const down = () => setNavigatorOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const pullBracketSnapshot = useCallback(async (): Promise<
    { ok: true; bracket: Bracket | null } | { ok: false; error?: string }
  > => {
    if (!tournamentId) return { ok: false, error: "" };
    if (zonesEnabled && !selectedZoneId) return { ok: false, error: "" };
    try {
      const url = zonesEnabled
        ? `/api/client/tournaments/${tournamentId}/bracket/zones/${encodeURIComponent(selectedZoneId)}`
        : `/api/client/tournaments/${tournamentId}/bracket`;
      const response = await fetch(url, { credentials: "same-origin" });
      const result = (await response.json()) as { bracket?: Bracket | null; error?: string };
      if (!response.ok) {
        return { ok: false, error: result.error ?? "대진표 조회에 실패했습니다." };
      }
      return { ok: true, bracket: result.bracket ?? null };
    } catch {
      return { ok: false, error: "대진표 조회 중 오류가 발생했습니다." };
    }
  }, [selectedZoneId, tournamentId, zonesEnabled]);

  const loadBracket = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      return;
    }
    const seg = storageSeg;
    const pulled = await pullBracketSnapshot();
    if (!pulled.ok) {
      if (!readOfflineDirty(tournamentId, seg)) {
        const cached = readLastGoodBracket<Bracket>(tournamentId, seg);
        setBracket((prev) => (prev == null && cached ? cached : prev));
      }
      setMessage("");
      return;
    }
    if (readOfflineDirty(tournamentId, seg)) {
      setMessage("");
      return;
    }
    setBracket(pulled.bracket);
    if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
    else writeLastGoodBracket(tournamentId, seg, null);
    setMessage("");
  }, [pullBracketSnapshot, storageSeg, tournamentId, zonesEnabled, selectedZoneId]);

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

  const replayOfflinePending = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (replayRunningRef.current) return;
    const seg = storageSeg;
    const ops = readOfflinePending(tournamentId, seg);
    if (!ops.length) return;
    try {
      replayRunningRef.current = true;
      setBracketSyncBusy(true);
      let work = bracketRef.current as BracketLike | null;
      if (!work) return;
      for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i]!;
        if (op.type === "winner_pick") {
          const rs = await syncWinnerPick({
            bracket: work,
            matchId: op.matchId,
            winnerUserId: op.winnerUserId,
            roundNumber: op.roundNumber,
            mut: mutationFns,
            hasDownstream,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          work = rs.bracket;
          setBracket(rs.bracket as Bracket);
        } else if (op.type === "clear_winner") {
          const rs = await syncClearMatchWinner({
            bracket: work,
            matchId: op.matchId,
            mut: mutationFns,
            hasDownstream,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          work = rs.bracket;
          setBracket(rs.bracket as Bracket);
        } else if (op.type === "rename") {
          const rs = await syncRenamePlayer({
            bracket: work,
            roundNumber: op.roundNumber,
            matchId: op.matchId,
            slot: op.slot,
            displayName: op.displayName,
            mut: mutationFns,
            hasDownstream,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          work = rs.bracket;
          setBracket(rs.bracket as Bracket);
        } else if (op.type === "swap") {
          const rs = await syncSwapPlayers({
            bracket: work,
            roundNumber: op.roundNumber,
            first: op.first,
            second: op.second,
            mut: mutationFns,
            hasDownstream,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          work = rs.bracket;
          setBracket(rs.bracket as Bracket);
        } else if (op.type === "shuffle_round") {
          const rs = await replayShuffleRoundFetch({
            tournamentId,
            bracketZoneQuery,
            roundNumber: op.roundNumber,
            scope: op.scope,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          work = rs.bracket;
          setBracket(rs.bracket as Bracket);
        }
      }
      writeOfflinePending(tournamentId, seg, []);
      setOfflineDirty(tournamentId, seg, false);
      if (work) writeLastGoodBracket(tournamentId, seg, work as Bracket);
      const pulled = await pullBracketSnapshot();
      if (pulled.ok && !readOfflineDirty(tournamentId, seg)) {
        setBracket(pulled.bracket);
        if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
      }
      setMessage("");
    } finally {
      setBracketSyncBusy(false);
      replayRunningRef.current = false;
    }
  }, [
    bracketZoneQuery,
    hasDownstream,
    mutationFns,
    pullBracketSnapshot,
    selectedZoneId,
    storageSeg,
    tournamentId,
    zonesEnabled,
  ]);

  useEffect(() => {
    const run = () => {
      void replayOfflinePending();
    };
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [replayOfflinePending]);

  useEffect(() => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) return;
    const seg = storageSeg;
    const cached = readLastGoodBracket<Bracket>(tournamentId, seg);
    if (cached) setBracket((prev) => prev ?? cached);
  }, [tournamentId, zonesEnabled, selectedZoneId, storageSeg]);

  useEffect(() => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) return;
    const seg = storageSeg;
    if (!readOfflinePending(tournamentId, seg).length) return;
    const t = window.setTimeout(() => {
      void replayOfflinePending();
    }, 350);
    return () => window.clearTimeout(t);
  }, [replayOfflinePending, selectedZoneId, storageSeg, tournamentId, zonesEnabled]);

  const handleExit = useCallback(() => {
    if (!tournamentId) return;
    router.replace(`/client/tournaments/${tournamentId}`);
  }, [router, tournamentId]);

  const handlePickWinner = useCallback(
    async (args: { matchId: string; winnerUserId: string; roundNumber: number }) => {
      if (!bracket || !tournamentId || isTournamentClosed || actionBusy) return;
      if (!isEligibleBracketWinnerUserId(args.winnerUserId)) return;
      const seg = storageSeg;
      const loc = findBracketMatchLocation(bracket as BracketLike, args.matchId);
      if (!loc) return;
      const currentMatch = loc.match;
      const changingWinner =
        typeof currentMatch.winnerUserId === "string" &&
        currentMatch.winnerUserId.trim() !== "" &&
        currentMatch.winnerUserId !== args.winnerUserId;

      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          if (changingWinner) {
            setSaveState("error");
            setMessage("승자 변경은 네트워크 연결 후 진행해 주세요.");
            return;
          }
          const next = applyLocalWinnerPick(bracket as BracketLike, args.matchId, args.winnerUserId);
          if (!next) {
            setSaveState("error");
            setMessage("경기 결과를 반영할 수 없습니다.");
            return;
          }
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, {
            type: "winner_pick",
            matchId: args.matchId,
            winnerUserId: args.winnerUserId,
            roundNumber: args.roundNumber,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          return;
        }
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
        writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
        setOfflineDirty(tournamentId, seg, false);
        setSaveState("idle");
        setMessage("");
      } catch {
        if (changingWinner) {
          setSaveState("error");
          setMessage("네트워크 오류 · 승자 변경은 연결 후 다시 시도해 주세요.");
          return;
        }
        const next = applyLocalWinnerPick(bracket as BracketLike, args.matchId, args.winnerUserId);
        if (next) {
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, {
            type: "winner_pick",
            matchId: args.matchId,
            winnerUserId: args.winnerUserId,
            roundNumber: args.roundNumber,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
        } else {
          setSaveState("error");
          setMessage("경기 결과 저장 중 오류가 발생했습니다.");
        }
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, storageSeg, tournamentId],
  );

  const handleSwapPlayers = useCallback(
    async (args: {
      roundNumber: number;
      first: { matchId: string; slot: "player1" | "player2" };
      second: { matchId: string; slot: "player1" | "player2" };
    }) => {
      if (!bracket || actionBusy || isTournamentClosed) return;
      const seg = storageSeg;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const next = applyLocalSwapPlayers(bracket as BracketLike, args.roundNumber, args.first, args.second);
          if (!next) {
            setSaveState("error");
            setMessage("선수 위치를 교체할 수 없습니다.");
            return;
          }
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, { type: "swap", roundNumber: args.roundNumber, first: args.first, second: args.second });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          return;
        }
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
        writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
        setOfflineDirty(tournamentId, seg, false);
        setSaveState("idle");
        setMessage("");
      } catch {
        const next = applyLocalSwapPlayers(bracket as BracketLike, args.roundNumber, args.first, args.second);
        if (next) {
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, { type: "swap", roundNumber: args.roundNumber, first: args.first, second: args.second });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
        } else {
          setSaveState("error");
          setMessage("선수 위치 교체 중 오류가 발생했습니다.");
        }
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, storageSeg, tournamentId],
  );

  const handleRenamePlayer = useCallback(
    async (args: { roundNumber: number; matchId: string; slot: "player1" | "player2"; displayName: string }) => {
      if (!bracket || actionBusy || isTournamentClosed) return;
      const seg = storageSeg;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const next = applyLocalRenamePlayer(bracket as BracketLike, args.matchId, args.slot, args.displayName);
          if (!next) {
            setSaveState("error");
            setMessage("이름을 수정할 수 없습니다.");
            return;
          }
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, {
            type: "rename",
            roundNumber: args.roundNumber,
            matchId: args.matchId,
            slot: args.slot,
            displayName: args.displayName,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          return;
        }
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
        writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
        setOfflineDirty(tournamentId, seg, false);
        setSaveState("idle");
        setMessage("");
      } catch {
        const next = applyLocalRenamePlayer(bracket as BracketLike, args.matchId, args.slot, args.displayName);
        if (next) {
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, {
            type: "rename",
            roundNumber: args.roundNumber,
            matchId: args.matchId,
            slot: args.slot,
            displayName: args.displayName,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
        } else {
          setSaveState("error");
          setMessage("선수 이름 수정 중 오류가 발생했습니다.");
        }
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, storageSeg, tournamentId],
  );

  const handleClearMatchWinner = useCallback(
    async (args: { matchId: string }): Promise<boolean> => {
      if (!bracket || !tournamentId || isTournamentClosed || actionBusy) return false;
      const seg = storageSeg;
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const next = applyLocalClearWinner(bracket as BracketLike, args.matchId);
          if (!next) {
            setSaveState("error");
            setMessage("진출을 취소할 수 없습니다.");
            return false;
          }
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, { type: "clear_winner", matchId: args.matchId });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          return true;
        }
        const rs = await syncClearMatchWinner({
          bracket: bracket as BracketLike,
          matchId: args.matchId,
          mut: mutationFns,
          hasDownstream,
        });
        if (!rs.ok) {
          setSaveState("error");
          setMessage(rs.error);
          return false;
        }
        setBracket(rs.bracket as Bracket);
        writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
        setOfflineDirty(tournamentId, seg, false);
        setSaveState("idle");
        setMessage("");
        return true;
      } catch {
        const next = applyLocalClearWinner(bracket as BracketLike, args.matchId);
        if (next) {
          setBracket(next as Bracket);
          writeLastGoodBracket(tournamentId, seg, next as Bracket);
          appendOfflinePending(tournamentId, seg, { type: "clear_winner", matchId: args.matchId });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
          return true;
        }
        setSaveState("error");
        setMessage("진출 취소 중 오류가 발생했습니다.");
        return false;
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, bracket, hasDownstream, isTournamentClosed, mutationFns, storageSeg, tournamentId],
  );

  const handleShuffleRound = useCallback(
    async (roundNumber: number) => {
      if (!bracket || actionBusy || isTournamentClosed || !tournamentId) return;
      const seg = storageSeg;
      const scope = shuffleScopeForSlice(bracket as BracketLike, boardSliceKey);
      setActionBusy(true);
      setSaveState("saving");
      setMessage("");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          appendOfflinePending(tournamentId, seg, { type: "shuffle_round", roundNumber, scope });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          return;
        }
        const res = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/shuffle-round-one${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              scope,
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
        writeLastGoodBracket(tournamentId, seg, json.bracket);
        setOfflineDirty(tournamentId, seg, false);
        setSaveState("idle");
        setMessage("");
      } catch {
        appendOfflinePending(tournamentId, seg, { type: "shuffle_round", roundNumber, scope });
        setOfflineDirty(tournamentId, seg, true);
        setSaveState("idle");
        setMessage("");
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, boardSliceKey, bracket, bracketZoneQuery, isTournamentClosed, storageSeg, tournamentId],
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
      unregisterCaromExplicitNativeLandscapeSession(CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID);
      applyCaromOrientationMode("portrait", "bracket-view-fullscreen:unmount");
    };
  }, []);

  const sliceStorageKey = useMemo(() => {
    if (!tournamentId || !bracket?.id) return null;
    const z = zonesEnabled ? selectedZoneId : "-";
    return `v3:bracketViewSlice:${tournamentId}:${z}:${bracket.id}`;
  }, [tournamentId, bracket?.id, zonesEnabled, selectedZoneId]);

  const handleBoardSliceChange = useCallback(
    (next: string | null) => {
      setBoardSliceKey(next);
      if (sliceStorageKey && typeof window !== "undefined" && next) {
        try {
          sessionStorage.setItem(sliceStorageKey, next);
        } catch {
          /* ignore */
        }
      }
    },
    [sliceStorageKey],
  );

  useEffect(() => {
    if (!bracket) {
      setBoardSliceKey(null);
      sliceMetaRef.current = { bracketId: "", blockSig: "" };
      return;
    }
    if (bracket.bracketMode !== "multi_block" || !bracket.blocks?.[0]) {
      setBoardSliceKey(null);
      sliceMetaRef.current = { bracketId: bracket.id, blockSig: "" };
      return;
    }
    const blockSig = bracket.blocks.map((b) => b.id).join("|");
    const { bracketId: prevBracketId, blockSig: prevSig } = sliceMetaRef.current;
    const structuralChange = prevBracketId !== bracket.id || prevSig !== blockSig;
    sliceMetaRef.current = { bracketId: bracket.id, blockSig };

    const readStoredSlice = (): string | null => {
      if (!sliceStorageKey || typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(sliceStorageKey);
        if (raw === "final" && bracket.finalBlock?.rounds?.length) return "final";
        if (raw?.startsWith("block:")) {
          const bid = raw.slice("block:".length);
          if (bracket.blocks!.some((b) => b.id === bid)) return raw;
        }
      } catch {
        /* ignore */
      }
      return null;
    };

    setBoardSliceKey((prevKey) => {
      const ids = new Set(bracket.blocks!.map((b) => b.id));
      const hasFinal = Boolean(bracket.finalBlock?.rounds?.length);

      if (structuralChange) {
        const stored = readStoredSlice();
        if (stored) return stored;
        if (prevKey === "final" && hasFinal) return "final";
        if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
          const bid = prevKey.slice("block:".length);
          if (ids.has(bid)) return prevKey;
        }
        return `block:${bracket.blocks![0].id}`;
      }

      if (prevKey === "final" && hasFinal) return prevKey;
      if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
        const bid = prevKey.slice("block:".length);
        if (ids.has(bid)) return prevKey;
      }
      return `block:${bracket.blocks![0].id}`;
    });
  }, [bracket, sliceStorageKey]);

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

  const viewStateStorageKey = useMemo(() => {
    if (!tournamentId || !boardBracket) return undefined;
    const z = zonesEnabled ? selectedZoneId : "-";
    return `v3:bracketViewUI:${tournamentId}:${z}:${boardBracket.id}`;
  }, [boardBracket, tournamentId, zonesEnabled, selectedZoneId]);

  const saveStateText = saveState === "saving" ? "저장 중..." : saveState === "error" ? "오류 발생" : "";

  const connectivityHint = !navigatorOnline ? "오프라인" : bracketSyncBusy ? "연결 복구 중" : "";

  const bracketViewSlicePicker =
    bracket?.bracketMode === "multi_block" && bracket.blocks?.length
      ? {
          blocks: bracket.blocks.map((bl) => ({ id: bl.id, label: bl.label })),
          hasFinal: Boolean(bracket.finalBlock?.rounds?.length),
          boardSliceKey,
          onSliceChange: handleBoardSliceChange,
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
        background: "#000000",
        overscrollBehavior: "none",
      }}
    >
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
            key={boardBracket.id}
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
            viewStateStorageKey={viewStateStorageKey}
            connectivityHint={connectivityHint}
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
