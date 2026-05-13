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
  bumpBracketLocalAuthorityRev,
  readBracketLocalAuthorityRev,
  readLastGoodBracket,
  readOfflineDirty,
  readOfflinePending,
  replayShuffleRoundFetch,
  setOfflineDirty,
  writeLastGoodBracket,
  writeOfflinePending,
} from "../bracket-offline-cache";
import viewStyles from "../bracket-view-page.module.css";
import type { BracketBoardPdfSnapshot } from "../bracket-pdf-client-export";
import {
  applyCaromOrientationMode,
  CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID,
  unregisterCaromExplicitNativeLandscapeSession,
} from "../../../../native-fullscreen-orientation-lock";

const InteractiveBracketBoard = dynamic(
  () => import("../InteractiveBracketBoard"),
  { ssr: false, loading: () => <p className="v3-muted">대진표를 불러오는 중입니다.</p> },
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
  /** 조분할 직전 루트 트리 스냅샷(서버 저장). */
  preSplitRootRounds?: BracketRoundView[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TournamentBracketBoardViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);
  const viewModeOriginalFull = useMemo(
    () => searchParams.get("viewMode")?.trim() === "originalFull",
    [searchParams],
  );

  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [isTournamentClosed, setIsTournamentClosed] = useState(false);
  const [tournamentTitle, setTournamentTitle] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentLocation, setTournamentLocation] = useState("");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [bracketDataLoading, setBracketDataLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [boardSliceKey, setBoardSliceKey] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const sliceMetaRef = useRef<{ bracketId: string; blockSig: string }>({ bracketId: "", blockSig: "" });
  /** `viewMode=merged` URL일 때 초기 `setBoardSliceKey("merged")` 중복 방지; URL에서 merged가 빠지면 리셋 */
  const appliedMergedFromUrlRef = useRef(false);
  /** 허브 등에서 `sliceKey` 쿼리로 들어올 때 브라켓 구조가 같아도 URL 변경을 감지한다 */
  const prevViewSliceKeyParamRef = useRef("");
  const bracketPdfSnapshotRef = useRef<(() => BracketBoardPdfSnapshot) | null>(null);
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
    appliedMergedFromUrlRef.current = false;
    prevViewSliceKeyParamRef.current = "";
  }, [tournamentId]);

  useEffect(() => {
    if (appliedMergedFromUrlRef.current) return;
    if (!bracket?.id || bracket.bracketMode !== "multi_block") return;
    if (searchParams.get("viewMode")?.trim() !== "merged") return;
    appliedMergedFromUrlRef.current = true;
    setBoardSliceKey("merged");
  }, [bracket?.id, bracket?.bracketMode, searchParams]);

  useEffect(() => {
    if (searchParams.get("viewMode")?.trim() !== "merged") {
      appliedMergedFromUrlRef.current = false;
    }
  }, [searchParams]);

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
    if (!tournamentId) {
      setBracketDataLoading(false);
      return;
    }
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      setBracketDataLoading(false);
      return;
    }
    const seg = storageSeg;
    const cached = readLastGoodBracket<Bracket>(tournamentId, seg);
    if (cached) {
      setBracket(cached);
      setBracketDataLoading(false);
    } else {
      setBracketDataLoading(true);
    }
    try {
      const pulled = await pullBracketSnapshot();
      if (!pulled.ok) {
        if (!readOfflineDirty(tournamentId, seg) && !cached) {
          const fallback = readLastGoodBracket<Bracket>(tournamentId, seg);
          setBracket((prev) => (prev == null && fallback ? fallback : prev));
        }
        setMessage("");
        return;
      }
      if (readOfflineDirty(tournamentId, seg)) {
        setMessage("");
        return;
      }
      if (!cached) {
        setBracket(pulled.bracket);
        if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
        else writeLastGoodBracket(tournamentId, seg, null);
      }
      setMessage("");
    } finally {
      if (!cached) {
        setBracketDataLoading(false);
      }
    }
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
      if (work) {
        writeLastGoodBracket(tournamentId, seg, work as Bracket);
        setBracket(work as Bracket);
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
      const winSliceKey = loc.sliceKey;
      const hasDownNow = hasDownstream(bracket as BracketLike, loc.round.roundNumber, winSliceKey);

      setMessage("");
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
        bumpBracketLocalAuthorityRev(tournamentId, seg);
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

      if (changingWinner && hasDownNow) {
        setActionBusy(true);
        setSaveState("saving");
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
          bumpBracketLocalAuthorityRev(tournamentId, seg);
          setBracket(rs.bracket as Bracket);
          writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
          setOfflineDirty(tournamentId, seg, false);
          setSaveState("idle");
        } catch {
          setSaveState("error");
          setMessage("네트워크 오류 · 승자 변경은 연결 후 다시 시도해 주세요.");
        } finally {
          setActionBusy(false);
        }
        return;
      }

      const before = bracket;
      const optimistic = applyLocalWinnerPick(before as BracketLike, args.matchId, args.winnerUserId);
      if (!optimistic) {
        setSaveState("error");
        setMessage("경기 결과를 반영할 수 없습니다.");
        return;
      }
      const localRev = bumpBracketLocalAuthorityRev(tournamentId, seg);
      setBracket(optimistic as Bracket);
      writeLastGoodBracket(tournamentId, seg, optimistic as Bracket);
      setOfflineDirty(tournamentId, seg, true);
      setSaveState("idle");

      void (async () => {
        try {
          const rs = await syncWinnerPick({
            bracket: before as BracketLike,
            matchId: args.matchId,
            winnerUserId: args.winnerUserId,
            roundNumber: args.roundNumber,
            mut: mutationFns,
            hasDownstream,
          });
          if (!rs.ok) {
            appendOfflinePending(tournamentId, seg, {
              type: "winner_pick",
              matchId: args.matchId,
              winnerUserId: args.winnerUserId,
              roundNumber: args.roundNumber,
            });
            setSaveState("error");
            setMessage(rs.error);
            return;
          }
          if (readBracketLocalAuthorityRev(tournamentId, seg) !== localRev) {
            return;
          }
          setBracket(rs.bracket as Bracket);
          writeLastGoodBracket(tournamentId, seg, rs.bracket as Bracket);
          setOfflineDirty(tournamentId, seg, false);
          setMessage("");
        } catch {
          appendOfflinePending(tournamentId, seg, {
            type: "winner_pick",
            matchId: args.matchId,
            winnerUserId: args.winnerUserId,
            roundNumber: args.roundNumber,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
        }
      })();
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
      if (bracket.bracketMode === "multi_block") {
        setSaveState("error");
        setMessage("조분할 상태에서는 다시 섞기를 사용할 수 없습니다. 「분할취소」로 단일 예선으로 복귀한 뒤 이용해 주세요.");
        return;
      }
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
      prevViewSliceKeyParamRef.current = "";
      return;
    }
    if (bracket.bracketMode !== "multi_block" || !bracket.blocks?.[0]) {
      setBoardSliceKey(null);
      sliceMetaRef.current = { bracketId: bracket.id, blockSig: "" };
      prevViewSliceKeyParamRef.current = "";
      return;
    }
    const sliceKeyParam = searchParams.get("sliceKey")?.trim() ?? "";
    const sliceKeyParamChanged = prevViewSliceKeyParamRef.current !== sliceKeyParam;
    prevViewSliceKeyParamRef.current = sliceKeyParam;

    const blockSig = bracket.blocks.map((b) => b.id).join("|");
    const { bracketId: prevBracketId, blockSig: prevSig } = sliceMetaRef.current;
    const structuralChange = prevBracketId !== bracket.id || prevSig !== blockSig;
    sliceMetaRef.current = { bracketId: bracket.id, blockSig };

    if (searchParams.get("viewMode")?.trim() === "originalFull") {
      setBoardSliceKey(null);
      return;
    }

    const readStoredSlice = (): string | null => {
      if (!sliceStorageKey || typeof window === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(sliceStorageKey);
        if (raw === "merged") return "merged";
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

    const resolveSliceFromUrl = (raw: string): string | null => {
      const ids = new Set(bracket.blocks!.map((b) => b.id));
      const hasFinal = Boolean(bracket.finalBlock?.rounds?.length);
      if (raw === "final" && hasFinal) return "final";
      if (raw.startsWith("block:")) {
        const bid = raw.slice("block:".length);
        if (ids.has(bid)) return raw;
      }
      return null;
    };

    setBoardSliceKey((prevKey) => {
      const viewModeMerged = searchParams.get("viewMode")?.trim() === "merged";
      if (viewModeMerged) {
        return "merged";
      }

      const ids = new Set(bracket.blocks!.map((b) => b.id));
      const hasFinal = Boolean(bracket.finalBlock?.rounds?.length);

      const fromUrl = resolveSliceFromUrl(sliceKeyParam);
      if (fromUrl && (structuralChange || sliceKeyParamChanged)) {
        return fromUrl;
      }

      if (structuralChange) {
        const stored = readStoredSlice();
        if (stored) return stored;
        if (prevKey === "merged") return "merged";
        if (prevKey === "final" && hasFinal) return "final";
        if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
          const bid = prevKey.slice("block:".length);
          if (ids.has(bid)) return prevKey;
        }
        return `block:${bracket.blocks![0].id}`;
      }

      if (prevKey === "merged") return "merged";
      if (prevKey === "final" && hasFinal) return prevKey;
      if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
        const bid = prevKey.slice("block:".length);
        if (ids.has(bid)) return prevKey;
      }
      return `block:${bracket.blocks![0].id}`;
    });
  }, [bracket, sliceStorageKey, searchParams]);

  const bracketViewMergedStacks = useMemo(() => {
    if (!bracket || bracket.bracketMode !== "multi_block" || boardSliceKey !== "merged" || !bracket.blocks?.length) {
      return null;
    }
    const stacks = bracket.blocks.map((bl) => ({
      sectionTitle: `조 ${bl.label ?? bl.id}`,
      bracket: { id: `${bracket.id}:merged:block:${bl.id}`, rounds: bl.rounds },
    }));
    if (bracket.finalBlock?.rounds?.length) {
      stacks.push({
        sectionTitle: "결선",
        bracket: { id: `${bracket.id}:merged:final`, rounds: bracket.finalBlock.rounds },
      });
    }
    return stacks;
  }, [bracket, boardSliceKey]);

  const boardBracket = useMemo(() => {
    if (!bracket) return null;
    if (viewModeOriginalFull) {
      if (bracket.bracketMode === "multi_block") {
        const rootLive = bracket.rounds?.length ? bracket.rounds : null;
        const rootPre = bracket.preSplitRootRounds?.length ? bracket.preSplitRootRounds : null;
        const root = rootLive ?? rootPre;
        if (!root?.length) return null;
        return { id: `${bracket.id}:originalFull`, rounds: root };
      }
      return { id: `${bracket.id}:root`, rounds: bracket.rounds };
    }
    let rounds: BracketRoundView[];
    if (bracket.bracketMode === "multi_block" && boardSliceKey) {
      if (boardSliceKey === "merged" && bracketViewMergedStacks?.length) {
        rounds = bracketViewMergedStacks[0]!.bracket.rounds;
      } else if (boardSliceKey === "final") {
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
  }, [bracket, boardSliceKey, bracketViewMergedStacks, viewModeOriginalFull]);

  const viewStateStorageKey = useMemo(() => {
    if (!tournamentId || !boardBracket) return undefined;
    const z = zonesEnabled ? selectedZoneId : "-";
    return `v3:bracketViewUI:${tournamentId}:${z}:${boardBracket.id}`;
  }, [boardBracket, tournamentId, zonesEnabled, selectedZoneId]);

  const saveStateText = saveState === "saving" ? "저장 중..." : saveState === "error" ? "오류 발생" : "";

  const connectivityHint = !navigatorOnline ? "오프라인" : bracketSyncBusy ? "연결 복구 중" : "";

  const bracketViewSlicePicker =
    viewModeOriginalFull || !(bracket?.bracketMode === "multi_block" && bracket.blocks?.length)
      ? null
      : {
          blocks: bracket.blocks.map((bl) => ({ id: bl.id, label: bl.label })),
          hasFinal: Boolean(bracket.finalBlock?.rounds?.length),
          hasMerged: true,
          boardSliceKey,
          onSliceChange: handleBoardSliceChange,
        };

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
        ) : bracketDataLoading ? (
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
            role="status"
            aria-live="polite"
          >
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 500 }}>대진표를 불러오는 중입니다.</p>
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
        ) : viewModeOriginalFull &&
          bracket.bracketMode === "multi_block" &&
          !(bracket.rounds?.length) &&
          !(bracket.preSplitRootRounds?.length) ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#e2e8f0",
              padding: "1rem",
              textAlign: "center",
              maxWidth: "26rem",
              margin: "0 auto",
            }}
          >
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700 }}>
              분할 전 단일 대진표 데이터가 없습니다.
            </p>
            <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55, color: "#cbd5e1" }}>
              이 대회는 조분할 시점에 원본 트리(<code style={{ color: "#f1f5f9" }}>preSplitRootRounds</code>)가 저장되지
              않았습니다. 이후 조분할부터는 자동 보관됩니다. 「통합 대진표 보기」로 예선·결선을 한 화면에서 확인하거나,
              대진표 관리의 「위험 작업」에서 분할 취소 후 단일 예선으로 복귀할 수 있습니다.
            </p>
          </div>
        ) : boardBracket ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              height: "100%",
            }}
          >
            {actionBusy && saveState === "saving" ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(0, 0, 0, 0.4)",
                  pointerEvents: "auto",
                }}
                role="status"
                aria-live="polite"
              >
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 500, color: "#e2e8f0", textAlign: "center", padding: "1rem" }}>
                  대진표를 불러오는 중입니다.
                </p>
              </div>
            ) : null}
            <InteractiveBracketBoard
              key={boardBracket.id}
              bracket={boardBracket}
              bracketPdfSnapshotRef={bracketPdfSnapshotRef}
              tournamentTitle={tournamentTitle}
              tournamentDate={tournamentDate}
              tournamentLocation={tournamentLocation}
              shuffleRoundHidden={bracket?.bracketMode === "multi_block"}
              interactionDisabled={isTournamentClosed || boardSliceKey === "merged" || viewModeOriginalFull}
              actionBusy={actionBusy}
              canUndo={false}
              saveStateText={saveStateText}
              chromeMode="bracketView"
              bracketViewSlicePicker={bracketViewSlicePicker}
              bracketViewMergedStacks={bracketViewMergedStacks}
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
          </div>
        ) : null}
      </section>
    </main>
  );
}
