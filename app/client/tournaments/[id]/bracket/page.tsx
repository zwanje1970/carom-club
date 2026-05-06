"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getShuffleRoundBlockedReason,
  type ShuffleGuardRound,
} from "../../../../../lib/bracket-shuffle-guards";

import BracketProgressSummaryCard from "./BracketProgressSummaryCard";
import { roundLabelFromMatchCount } from "./bracket-progress-utils";

const TournamentGroupRound1PrintClient = dynamic(
  () => import("./TournamentGroupRound1PrintClient"),
  { ssr: false, loading: () => <p className="v3-muted">조별 1차 대진표 인쇄 도구를 불러오는 중…</p> },
);

type BracketParticipant = {
  userId: string;
  applicantName: string;
  phone: string;
};

type BracketParticipantSnapshot = {
  id: string;
  tournamentId: string;
  participants: BracketParticipant[];
  createdAt: string;
  zoneId?: string | null;
};

type BracketRoundDoc = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: Array<{
    id: string;
    player1: { userId: string; name: string };
    player2: { userId: string; name: string };
    winnerUserId: string | null;
    winnerName: string | null;
    status: "PENDING" | "COMPLETED";
  }>;
};

type Bracket = {
  id: string;
  tournamentId: string;
  snapshotId: string;
  zoneId?: string | null;
  rounds: BracketRoundDoc[];
  createdAt: string;
  bracketMode?: "single" | "multi_block";
  blocks?: Array<{ id: string; label?: string; rounds: BracketRoundDoc[] }>;
  finalBlock?: { rounds: BracketRoundDoc[] };
};

function getSliceRoundsFromBracket(b: Bracket, sliceKey: string | null): BracketRoundDoc[] {
  if (b.bracketMode === "multi_block" && sliceKey) {
    if (sliceKey === "final") return b.finalBlock?.rounds ?? [];
    if (sliceKey.startsWith("block:")) {
      const bid = sliceKey.slice("block:".length);
      return b.blocks?.find((bl) => bl.id === bid)?.rounds ?? [];
    }
    return [];
  }
  return b.rounds;
}

function findBracketMatchLocation(
  bracket: Bracket,
  matchId: string,
): {
  round: BracketRoundDoc;
  match: BracketRoundDoc["matches"][number];
  sliceKey: string | null;
  sliceRounds: BracketRoundDoc[];
} | null {
  const id = matchId.trim();
  if (!id) return null;
  if (bracket.bracketMode === "multi_block" && bracket.blocks?.length) {
    for (const block of bracket.blocks) {
      for (const round of block.rounds) {
        const match = round.matches.find((m) => m.id === id);
        if (match) return { round, match, sliceKey: `block:${block.id}`, sliceRounds: block.rounds };
      }
    }
    const finals = bracket.finalBlock?.rounds;
    if (finals) {
      for (const round of finals) {
        const match = round.matches.find((m) => m.id === id);
        if (match) return { round, match, sliceKey: "final", sliceRounds: finals };
      }
    }
    return null;
  }
  for (const round of bracket.rounds) {
    const match = round.matches.find((m) => m.id === id);
    if (match) return { round, match, sliceKey: null, sliceRounds: bracket.rounds };
  }
  return null;
}

function hasDownstreamRoundsInSlice(sliceRounds: BracketRoundDoc[], roundNumber: number): boolean {
  return sliceRounds.some((r) => r.roundNumber > roundNumber);
}

function getFinalRoundForCompletion(b: Bracket): BracketRoundDoc | null {
  if (b.bracketMode === "multi_block" && b.finalBlock?.rounds?.length) {
    return b.finalBlock.rounds[b.finalBlock.rounds.length - 1] ?? null;
  }
  return b.rounds[b.rounds.length - 1] ?? null;
}

/** 단일(root) 확정 대진표만 분할 가능 */
function canSplitBracket(b: Bracket | null): boolean {
  if (!b || b.bracketMode === "multi_block") return false;
  return b.rounds.some((r) => r.roundNumber === 1 && r.matches.length > 0);
}

function rootRoundOneSlotCount(b: Bracket): number {
  const r1 = b.rounds.find((r) => r.roundNumber === 1);
  if (!r1) return 0;
  return r1.matches.length * 2;
}

function projectedQualifierBlockCount(b: Bracket, blockSize: number): number {
  const n = rootRoundOneSlotCount(b);
  const bs = Math.max(1, Math.floor(blockSize));
  if (n <= 0) return 0;
  return Math.ceil(n / bs);
}

function shuffleScopeForSlice(
  b: Bracket,
  sliceKey: string | null,
): "final_only" | "qualifiers_only" | { blockId: string } {
  if (b.bracketMode !== "multi_block") return "qualifiers_only";
  if (sliceKey === "final") return "final_only";
  if (sliceKey?.startsWith("block:")) {
    return { blockId: sliceKey.slice("block:".length) };
  }
  return "qualifiers_only";
}

type SaveState = "idle" | "saving" | "saved" | "error";

function bracketSnapshotStorageKey(tournamentId: string, zoneId: string, bracketId: string): string {
  return `v3:bracket:snapshot:${tournamentId}:${zoneId || "global"}:${bracketId}`;
}

function zoneFinalizedStorageKey(tournamentId: string, zoneId: string): string {
  return `v3:bracket:zone-finalized:${tournamentId}:${zoneId || "global"}`;
}

const UNDO_LIMIT = 20;

function cloneBracketSnapshot(bracket: Bracket): Bracket {
  return JSON.parse(JSON.stringify(bracket)) as Bracket;
}

function defaultBoardSliceKey(b: Bracket | null): string | null {
  if (!b || b.bracketMode !== "multi_block" || !b.blocks?.[0]) return null;
  return `block:${b.blocks[0].id}`;
}

function undoSliceMapKey(sliceKey: string | null): string {
  return sliceKey ?? "__root__";
}

/** 단일 대진표는 한 슬라이스, 분할 대진표는 조별·결선 각각 — 되돌리기 비교용 */
function bracketUndoSlices(b: Bracket): Array<{ sliceKey: string | null; rounds: BracketRoundDoc[] }> {
  if (b.bracketMode === "multi_block" && b.blocks?.length) {
    const out: Array<{ sliceKey: string | null; rounds: BracketRoundDoc[] }> = [];
    for (const bl of b.blocks) {
      out.push({ sliceKey: `block:${bl.id}`, rounds: bl.rounds });
    }
    if (b.finalBlock?.rounds?.length) {
      out.push({ sliceKey: "final", rounds: b.finalBlock.rounds });
    }
    return out;
  }
  return [{ sliceKey: null, rounds: b.rounds }];
}

export default function TournamentBracketSnapshotPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);
  const [snapshot, setSnapshot] = useState<BracketParticipantSnapshot | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [undoStack, setUndoStack] = useState<Bracket[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [snapshotImageUrl, setSnapshotImageUrl] = useState<string | null>(null);
  const [snapshotCaptureFailed, setSnapshotCaptureFailed] = useState(false);
  const [zoneFinalizedLocked, setZoneFinalizedLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [isTournamentClosed, setIsTournamentClosed] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [printToolsOpen, setPrintToolsOpen] = useState(false);
  const [boardSliceKey, setBoardSliceKey] = useState<string | null>(null);
  const [multiBlockSize, setMultiBlockSize] = useState(16);
  const [multiBlockBusy, setMultiBlockBusy] = useState(false);
  const [listOpenRoundNumber, setListOpenRoundNumber] = useState<number | null>(null);
  const confirmedSectionRef = useRef<HTMLElement | null>(null);
  const didInitialBoardFocusRef = useRef(false);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingActionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setBoardSliceKey(defaultBoardSliceKey(bracket));
  }, [bracket?.id, bracket?.bracketMode, bracket?.blocks]);

  const displayRounds = useMemo(() => {
    if (!bracket) return [];
    return getSliceRoundsFromBracket(bracket, boardSliceKey);
  }, [bracket, boardSliceKey]);

  const sliceRoundsForShuffleGuard = useMemo((): ShuffleGuardRound[] => {
    if (!bracket) return [];
    return getSliceRoundsFromBracket(bracket, boardSliceKey) as ShuffleGuardRound[];
  }, [bracket, boardSliceKey]);

  const splitPreviewLine = useMemo(() => {
    if (!bracket || !canSplitBracket(bracket)) return null;
    const total = rootRoundOneSlotCount(bracket);
    const groups = projectedQualifierBlockCount(bracket, multiBlockSize);
    if (total <= 0) return null;
    return `총 ${total}명 → ${multiBlockSize}명씩 → ${groups}개 조 생성`;
  }, [bracket, multiBlockSize]);

  const displayRoundsSorted = useMemo(
    () => [...displayRounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [displayRounds],
  );

  useEffect(() => {
    setListOpenRoundNumber(null);
  }, [bracket?.id, boardSliceKey]);

  const loadLatestSnapshot = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setSnapshot(null);
      return;
    }
    try {
      const q = zonesEnabled && selectedZoneId ? `?zoneId=${encodeURIComponent(selectedZoneId)}` : "";
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/participants-snapshot${q}`, {
        credentials: "same-origin",
      });
      const result = (await response.json()) as {
        snapshot?: BracketParticipantSnapshot | null;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? "작성 기준 참가자 정보를 불러오지 못했습니다.");
        return;
      }
      setSnapshot(result.snapshot ?? null);
    } catch {
      setMessage("작성 기준 참가자 정보를 불러오는 중 오류가 발생했습니다.");
    }
  }, [tournamentId, zonesEnabled, selectedZoneId]);

  const loadLatestBracket = useCallback(async () => {
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
    } catch {
      setMessage("대진표 조회 중 오류가 발생했습니다.");
    }
  }, [tournamentId, zonesEnabled, selectedZoneId]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`, { credentials: "same-origin" });
        const json = (await res.json()) as { tournament?: { zonesEnabled?: boolean; statusBadge?: string | null } };
        if (!res.ok || cancelled || !json.tournament) return;
        setZonesEnabled(json.tournament.zonesEnabled === true);
        setIsTournamentClosed((json.tournament.statusBadge ?? "") === "종료");
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
    void loadLatestSnapshot();
    void loadLatestBracket();
  }, [loadLatestSnapshot, loadLatestBracket]);

  useEffect(() => {
    didInitialBoardFocusRef.current = false;
  }, [tournamentId, selectedZoneId]);

  useEffect(() => {
    if (didInitialBoardFocusRef.current) return;
    if (!bracket) return;
    if (zonesEnabled && !selectedZoneId) return;
    confirmedSectionRef.current?.scrollIntoView({ block: "start" });
    didInitialBoardFocusRef.current = true;
  }, [bracket, selectedZoneId, zonesEnabled]);

  useEffect(() => {
    if (!tournamentId) return;
    const zoneKey = zoneFinalizedStorageKey(tournamentId, selectedZoneId);
    setZoneFinalizedLocked(window.localStorage.getItem(zoneKey) === "1");
  }, [selectedZoneId, tournamentId]);

  useEffect(() => {
    if (!tournamentId || !bracket) {
      setSnapshotImageUrl(null);
      return;
    }
    const key = bracketSnapshotStorageKey(tournamentId, selectedZoneId, bracket.id);
    const saved = window.localStorage.getItem(key);
    setSnapshotImageUrl(saved || null);
  }, [bracket, selectedZoneId, tournamentId]);

  useEffect(() => {
    if (!bracket || !zonesEnabled) return;
    const finalRound = getFinalRoundForCompletion(bracket);
    const finalMatch = finalRound?.matches?.[0] ?? null;
    const finalized =
      !!finalRound &&
      finalRound.matches.length === 1 &&
      !!finalMatch &&
      finalMatch.status === "COMPLETED" &&
      !!finalMatch.winnerUserId;
    if (!finalized) return;
    const key = zoneFinalizedStorageKey(tournamentId, selectedZoneId);
    window.localStorage.setItem(key, "1");
    setZoneFinalizedLocked(true);
  }, [bracket, selectedZoneId, tournamentId, zonesEnabled]);


  const pushUndoSnapshot = useCallback((source: Bracket | null) => {
    if (!source) return;
    const snap = cloneBracketSnapshot(source);
    setUndoStack((prev) => {
      const next = [...prev, snap];
      return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
    });
  }, []);

  const rollbackLastUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => prev.slice(0, -1));
  }, []);

  const runMatchResultMutation = useCallback(
    async (matchId: string, winnerUserId: string | null) => {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/result${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerUserId }),
        },
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        return { ok: false as const, error: result.error ?? "경기 결과 저장에 실패했습니다." };
      }
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const runAdvanceRoundMutation = useCallback(
    async (roundNumber: number, sliceKey?: string | null) => {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/rounds/${roundNumber}/advance${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sliceKey ? { sliceKey } : {}),
        },
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        return { ok: false as const, error: result.error ?? "다음 라운드 생성에 실패했습니다." };
      }
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const interactionLocked = isTournamentClosed || zoneFinalizedLocked;
  const canUndo = !interactionLocked && undoStack.length > 0 && !actionLoading;
  const saveStateText =
    saveState === "saving" ? "저장 중..." : saveState === "saved" ? "저장됨" : saveState === "error" ? "오류 발생" : "";

  const enqueueMutation = useCallback(
    (actionKey: string, runner: () => Promise<void>) => {
      if (pendingActionKeysRef.current.has(actionKey)) return;
      pendingActionKeysRef.current.add(actionKey);
      actionQueueRef.current = actionQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          setActionLoading(true);
          setSaveState("saving");
          try {
            await runner();
          } finally {
            pendingActionKeysRef.current.delete(actionKey);
            setActionLoading(false);
          }
        });
    },
    [],
  );

  const hasDownstreamRounds = useCallback((target: Bracket, roundNumber: number, sliceKey: string | null) => {
    return hasDownstreamRoundsInSlice(getSliceRoundsFromBracket(target, sliceKey), roundNumber);
  }, []);

  const runResetAfterMutation = useCallback(
    async (roundNumber: number, sliceKey?: string | null) => {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/rounds/${roundNumber}/reset-after${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sliceKey ? { sliceKey } : {}),
        },
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        return { ok: false as const, error: result.error ?? "이후 라운드 초기화에 실패했습니다." };
      }
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const runRebuildFromRoundMutation = useCallback(
    async (roundNumber: number, sliceKey?: string | null) => {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/rebuild-from-round${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const runReassignMutation = useCallback(
    async (
      roundNumber: number,
      operations: Array<
        | { type: "swap_within_match"; matchId: string }
        | {
            type: "swap_between_matches";
            matchAId: string;
            slotA: "player1" | "player2";
            matchBId: string;
            slotB: "player1" | "player2";
          }
      >,
      sliceKey?: string | null,
    ) => {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/bracket/matches/reassign${bracketZoneQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const runRenamePlayerMutation = useCallback(
    async (matchId: string, slot: "player1" | "player2", displayName: string) => {
      const response = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/matches/${matchId}/player${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, displayName }),
        },
      );
      const result = (await response.json()) as { bracket?: Bracket; error?: string };
      if (!response.ok || !result.bracket) {
        return { ok: false as const, error: result.error ?? "선수 이름 수정에 실패했습니다." };
      }
      return { ok: true as const, bracket: result.bracket };
    },
    [bracketZoneQuery, tournamentId],
  );

  const runSetTournamentClosedMutation = useCallback(async () => {
    const response = await fetch(`/api/client/tournaments/${tournamentId}/status-badge`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusBadge: "종료" }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      return { ok: false as const, error: result.error ?? "대회 종료 처리에 실패했습니다." };
    }
    return { ok: true as const };
  }, [tournamentId]);

  const captureBracketImageSnapshot = useCallback(
    async (targetBracket: Bracket): Promise<string | null> => {
      try {
        const root = document.querySelector("[data-interactive-bracket-root='1']") as HTMLElement | null;
        if (!root) return null;
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(root, {
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          scale: 1.2,
        });
        const dataUrl = canvas.toDataURL("image/png");
        if (!dataUrl) return null;
        const key = bracketSnapshotStorageKey(tournamentId, selectedZoneId, targetBracket.id);
        window.localStorage.setItem(key, dataUrl);
        setSnapshotImageUrl(dataUrl);
        setSnapshotCaptureFailed(false);
        return dataUrl;
      } catch {
        setSnapshotCaptureFailed(true);
        return null;
      }
    },
    [selectedZoneId, tournamentId],
  );

  const processFinalCompletion = useCallback(
    async (nextBracket: Bracket) => {
      const finalRound = getFinalRoundForCompletion(nextBracket);
      const finalMatch = finalRound?.matches?.[0] ?? null;
      if (!finalRound || !finalMatch) return false;
      const isFinalDone =
        finalRound.matches.length === 1 &&
        finalMatch.status === "COMPLETED" &&
        typeof finalMatch.winnerUserId === "string" &&
        finalMatch.winnerUserId.trim() !== "";
      if (!isFinalDone) return false;

      await captureBracketImageSnapshot(nextBracket);
      if (zonesEnabled) {
        const zoneKey = zoneFinalizedStorageKey(tournamentId, selectedZoneId);
        window.localStorage.setItem(zoneKey, "1");
        setZoneFinalizedLocked(true);
        setMessage("권역 결승이 종료되어 읽기 전용으로 잠금되었습니다.");
        setSaveState("saved");
        return true;
      }

      const closed = await runSetTournamentClosedMutation();
      if (!closed.ok) {
        setSaveState("error");
        setMessage(closed.error);
        return true;
      }
      setIsTournamentClosed(true);
      setMessage("결승 종료로 대회가 자동 종료되었습니다.");
      setSaveState("saved");
      return true;
    },
    [captureBracketImageSnapshot, runSetTournamentClosedMutation, selectedZoneId, tournamentId, zonesEnabled],
  );

  useEffect(() => {
    if (!bracket) return;
    if (!interactionLocked) return;
    if (snapshotImageUrl || snapshotCaptureFailed) return;
    void captureBracketImageSnapshot(bracket);
  }, [bracket, captureBracketImageSnapshot, interactionLocked, snapshotCaptureFailed, snapshotImageUrl]);

  async function handleSetWinner(matchId: string, winnerUserId: string, roundNumber?: number) {
    if (!tournamentId) return;
    if (interactionLocked) {
      setMessage("종료된 대회는 결과를 수정할 수 없습니다.");
      return;
    }
    const current = bracket;
    if (!current) {
      setMessage("확정 대진표가 없습니다.");
      return;
    }
    const loc = findBracketMatchLocation(current, matchId);
    if (!loc) {
      setMessage("대상 매치를 찾을 수 없습니다.");
      return;
    }
    const { round: currentRound, match: currentMatch, sliceKey: winSliceKey, sliceRounds } = loc;
    const changingWinner =
      typeof currentMatch.winnerUserId === "string" &&
      currentMatch.winnerUserId.trim() !== "" &&
      currentMatch.winnerUserId !== winnerUserId;
    if (changingWinner) {
      const hasNextRound = sliceRounds.some((r) => r.roundNumber === currentRound.roundNumber + 1);
      if (hasNextRound) {
        if (
          !window.confirm("이전 라운드 승자를 변경하면 이후 라운드가 초기화됩니다. 계속 진행할까요?")
        ) {
          return;
        }
      } else if (!window.confirm("승자를 변경합니다. 계속 진행할까요?")) {
        return;
      }
    }
    enqueueMutation(`winner:${matchId}`, async () => {
      pushUndoSnapshot(current);
      setMessage("");
      try {
        let workingBracket = current;
        if (changingWinner && hasDownstreamRounds(workingBracket, currentRound.roundNumber, winSliceKey)) {
          const resetResult = await runResetAfterMutation(currentRound.roundNumber, winSliceKey);
          if (!resetResult.ok) {
            rollbackLastUndoSnapshot();
            setSaveState("error");
            setMessage(resetResult.error);
            return;
          }
          workingBracket = resetResult.bracket;
          setBracket(workingBracket);
        }

        const result = await runMatchResultMutation(matchId, winnerUserId);
        if (!result.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(result.error);
          return;
        }
        let nextBracket = result.bracket;
        if (changingWinner) {
          const rebuildResult = await runRebuildFromRoundMutation(currentRound.roundNumber, winSliceKey);
          if (!rebuildResult.ok) {
            rollbackLastUndoSnapshot();
            setSaveState("error");
            setMessage(rebuildResult.error);
            return;
          }
          nextBracket = rebuildResult.bracket;
        }
        let nextMessage = "경기 결과가 반영되었습니다.";
        const sliceAfter = getSliceRoundsFromBracket(nextBracket, winSliceKey);
        const rr =
          typeof roundNumber === "number" ? sliceAfter.find((r) => r.roundNumber === roundNumber) ?? null : null;
        const shouldAdvance =
          rr !== null &&
          rr.status === "COMPLETED" &&
          !sliceAfter.some((r) => r.roundNumber === rr.roundNumber + 1);
        if (shouldAdvance) {
          const advResult = await runAdvanceRoundMutation(rr!.roundNumber, winSliceKey);
          if (advResult.ok) {
            nextBracket = advResult.bracket;
            nextMessage = `경기 결과가 반영되었고 Round ${rr!.roundNumber + 1}이 생성되었습니다.`;
          } else {
            nextMessage = `경기 결과 반영 완료 · ${advResult.error}`;
          }
        }
        setBracket(nextBracket);
        const finalProcessed = await processFinalCompletion(nextBracket);
        if (!finalProcessed) {
          setSaveState("saved");
          setMessage(nextMessage);
        }
      } catch {
        rollbackLastUndoSnapshot();
        setSaveState("error");
        setMessage("경기 결과 저장 중 오류가 발생했습니다.");
      }
    });
  }

  async function handleAdvanceRound(roundNumber: number) {
    if (!tournamentId || actionLoading) return;
    if (interactionLocked) {
      setMessage("종료된 대회는 라운드를 진행할 수 없습니다.");
      return;
    }
    if (!bracket) return;
    pushUndoSnapshot(bracket);
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      const result = await runAdvanceRoundMutation(roundNumber, boardSliceKey);
      if (!result.ok) {
        rollbackLastUndoSnapshot();
        setSaveState("error");
        setMessage(result.error);
        return;
      }
      setBracket(result.bracket);
      setSaveState("saved");
      setMessage(`Round ${roundNumber + 1}이 생성되었습니다.`);
    } catch {
      rollbackLastUndoSnapshot();
      setSaveState("error");
      setMessage("다음 라운드 생성 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function executeRoundShuffle(roundNumber: number) {
    if (!tournamentId || !bracket) return;
    setMultiBlockBusy(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/client/tournaments/${tournamentId}/bracket/shuffle-round-one${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            scope: shuffleScopeForSlice(bracket, boardSliceKey),
            roundNumber,
          }),
        },
      );
      const json = (await res.json()) as { bracket?: Bracket; error?: string };
      if (!res.ok || !json.bracket) {
        setMessage(json.error ?? "라운드 재배치에 실패했습니다.");
        return;
      }
      setBracket(json.bracket);
      setMessage(`Round ${roundNumber}이(가) 재배치되었습니다.`);
    } finally {
      setMultiBlockBusy(false);
    }
  }

  async function handleUndo() {
    if (!canUndo || actionLoading) return;
    if (interactionLocked) {
      setMessage("종료된 대회는 되돌리기를 할 수 없습니다.");
      return;
    }
    if (!bracket) {
      setMessage("현재 대진표가 없어 되돌릴 수 없습니다.");
      return;
    }
    const target = undoStack[undoStack.length - 1] ?? null;
    if (!target) return;

    const targetSlices = bracketUndoSlices(target);
    const currentSlices = bracketUndoSlices(bracket);
    const currentByKey = new Map(currentSlices.map((s) => [undoSliceMapKey(s.sliceKey), s]));

    if (targetSlices.length !== currentSlices.length) {
      setMessage("대진표 슬라이스 구조가 달라 되돌리기가 불가능합니다.");
      return;
    }

    const winnerDiffs: Array<{ matchId: string; winnerUserId: string | null; roundNumber: number }> = [];

    for (const ts of targetSlices) {
      const cs = currentByKey.get(undoSliceMapKey(ts.sliceKey));
      if (!cs) {
        setMessage("대진표 슬라이스 구조가 달라 되돌리기가 불가능합니다.");
        return;
      }
      if (ts.rounds.length !== cs.rounds.length) {
        setMessage(
          "라운드 수가 달라져 현재 API만으로 안전 복원이 불가능합니다. (라운드 삭제/리빌드 Undo API 필요)",
        );
        return;
      }

      const currentRoundByNumber = new Map(cs.rounds.map((r) => [r.roundNumber, r]));
      const hasNextRound = (roundNumber: number) => cs.rounds.some((r) => r.roundNumber === roundNumber + 1);

      for (const targetRound of ts.rounds) {
        const currentRound = currentRoundByNumber.get(targetRound.roundNumber);
        if (!currentRound) {
          setMessage("라운드 구조가 달라 안전 복원이 불가능합니다. (브래킷 전체 복원 API 필요)");
          return;
        }
        if (currentRound.matches.length !== targetRound.matches.length) {
          setMessage("매치 수가 달라 안전 복원이 불가능합니다. (브래킷 전체 복원 API 필요)");
          return;
        }
        for (let idx = 0; idx < targetRound.matches.length; idx += 1) {
          const cm = currentRound.matches[idx]!;
          const tm = targetRound.matches[idx]!;
          if (cm.id !== tm.id) {
            setMessage("매치 식별자가 달라 안전 복원이 불가능합니다. (브래킷 전체 복원 API 필요)");
            return;
          }
          const samePlayers =
            cm.player1.userId === tm.player1.userId &&
            cm.player2.userId === tm.player2.userId &&
            cm.player1.name === tm.player1.name &&
            cm.player2.name === tm.player2.name;
          if (!samePlayers) {
            setMessage("참가자 슬롯 변경 Undo는 현재 API로 안전 복원이 불가능합니다. (슬롯 스냅샷 복원 API 필요)");
            return;
          }
          const cw = cm.winnerUserId ?? null;
          const tw = tm.winnerUserId ?? null;
          if (cw !== tw) {
            if (hasNextRound(targetRound.roundNumber)) {
              setMessage(
                "다음 라운드가 생성된 이전 라운드 승자 변경 Undo는 현재 API에서 차단됩니다. (하위 라운드 초기화/재계산 API 필요)",
              );
              return;
            }
            winnerDiffs.push({ matchId: cm.id, winnerUserId: tw, roundNumber: targetRound.roundNumber });
          }
        }
      }
    }

    if (winnerDiffs.length === 0) {
      setUndoStack((prev) => prev.slice(0, -1));
      setMessage("되돌릴 변경이 없어 스택만 정리했습니다.");
      return;
    }

    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let latest = bracket;
      for (const diff of winnerDiffs) {
        const rs = await runMatchResultMutation(diff.matchId, diff.winnerUserId);
        if (!rs.ok) {
          setMessage(`되돌리기 실패: ${rs.error}`);
          setSaveState("error");
          return;
        }
        latest = rs.bracket;
      }
      setBracket(latest);
      setUndoStack((prev) => prev.slice(0, -1));
      setSaveState("saved");
      setMessage("되돌리기가 완료되었습니다.");
    } catch {
      setSaveState("error");
      setMessage("되돌리기 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSwapPlayers(args: {
    roundNumber: number;
    first: { matchId: string; slot: "player1" | "player2" };
    second: { matchId: string; slot: "player1" | "player2" };
  }) {
    if (!bracket || actionLoading || interactionLocked) return;
    if (args.first.matchId === args.second.matchId && args.first.slot === args.second.slot) return;
    const loc = findBracketMatchLocation(bracket, args.first.matchId);
    const swapSlice = loc?.sliceKey ?? null;
    if (bracket.bracketMode === "multi_block" && swapSlice === null) {
      setMessage("분할 대진표에서 매치 위치를 특정할 수 없습니다.");
      return;
    }
    pushUndoSnapshot(bracket);
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let next = bracket;
      if (hasDownstreamRounds(next, args.roundNumber, swapSlice)) {
        const reset = await runResetAfterMutation(args.roundNumber, swapSlice);
        if (!reset.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(reset.error);
          return;
        }
        next = reset.bracket;
        setBracket(next);
      }
      const swapped = await runReassignMutation(
        args.roundNumber,
        [
          {
            type: "swap_between_matches",
            matchAId: args.first.matchId,
            slotA: args.first.slot,
            matchBId: args.second.matchId,
            slotB: args.second.slot,
          },
        ],
        swapSlice,
      );
      if (!swapped.ok) {
        rollbackLastUndoSnapshot();
        setSaveState("error");
        setMessage(swapped.error);
        return;
      }
      next = swapped.bracket;
      if (hasDownstreamRounds(bracket, args.roundNumber, swapSlice)) {
        const rebuilt = await runRebuildFromRoundMutation(args.roundNumber, swapSlice);
        if (!rebuilt.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(rebuilt.error);
          return;
        }
        next = rebuilt.bracket;
      }
      setBracket(next);
      setSaveState("saved");
      setMessage("선수 위치가 교체되었습니다.");
    } catch {
      rollbackLastUndoSnapshot();
      setSaveState("error");
      setMessage("선수 위치 교체 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRenamePlayer(args: {
    roundNumber: number;
    matchId: string;
    slot: "player1" | "player2";
    displayName: string;
  }) {
    if (!bracket || actionLoading || interactionLocked) return;
    const nextName = args.displayName.trim();
    if (!nextName) return;
    const loc = findBracketMatchLocation(bracket, args.matchId);
    const renameSlice = loc?.sliceKey ?? null;
    if (bracket.bracketMode === "multi_block" && renameSlice === null) {
      setMessage("분할 대진표에서 매치 위치를 특정할 수 없습니다.");
      return;
    }
    pushUndoSnapshot(bracket);
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let next = bracket;
      if (hasDownstreamRounds(next, args.roundNumber, renameSlice)) {
        const reset = await runResetAfterMutation(args.roundNumber, renameSlice);
        if (!reset.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(reset.error);
          return;
        }
        next = reset.bracket;
        setBracket(next);
      }

      const renamed = await runRenamePlayerMutation(args.matchId, args.slot, nextName);
      if (!renamed.ok) {
        rollbackLastUndoSnapshot();
        setSaveState("error");
        setMessage(renamed.error);
        return;
      }
      next = renamed.bracket;
      if (hasDownstreamRounds(bracket, args.roundNumber, renameSlice)) {
        const rebuilt = await runRebuildFromRoundMutation(args.roundNumber, renameSlice);
        if (!rebuilt.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(rebuilt.error);
          return;
        }
        next = rebuilt.bracket;
      }
      setBracket(next);
      setSaveState("saved");
      setMessage("선수 이름이 수정되었습니다.");
    } catch {
      rollbackLastUndoSnapshot();
      setSaveState("error");
      setMessage("선수 이름 수정 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleShuffleCurrentRound(roundNumber: number) {
    if (!bracket || actionLoading || interactionLocked) return;
    const sliceRounds = getSliceRoundsFromBracket(bracket, boardSliceKey);
    const targetRound = sliceRounds.find((r) => r.roundNumber === roundNumber) ?? null;
    if (!targetRound || targetRound.matches.length === 0) {
      setSaveState("error");
      setMessage("대상 라운드를 찾을 수 없습니다.");
      return;
    }
    const players = targetRound.matches.flatMap((m) => [m.player1, m.player2]);
    if (players.some((p) => !p.userId.trim() || p.userId.startsWith("__TBD__:") || p.name.trim().toUpperCase() === "TBD")) {
      setSaveState("error");
      setMessage("인원이 확정되지 않았습니다.");
      return;
    }
    const operations: Array<{
      type: "swap_between_matches";
      matchAId: string;
      slotA: "player1" | "player2";
      matchBId: string;
      slotB: "player1" | "player2";
    }> = [];
    const matchIds = targetRound.matches.map((m) => m.id);
    for (let i = 0; i < matchIds.length; i += 1) {
      const j = Math.floor(Math.random() * matchIds.length);
      if (i === j) continue;
      operations.push({
        type: "swap_between_matches",
        matchAId: matchIds[i]!,
        slotA: "player1",
        matchBId: matchIds[j]!,
        slotB: "player1",
      });
      operations.push({
        type: "swap_between_matches",
        matchAId: matchIds[i]!,
        slotA: "player2",
        matchBId: matchIds[j]!,
        slotB: "player2",
      });
    }
    if (operations.length === 0) {
      setSaveState("saved");
      setMessage("재배치할 매치가 충분하지 않습니다.");
      return;
    }
    pushUndoSnapshot(bracket);
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let next = bracket;
      if (hasDownstreamRounds(next, roundNumber, boardSliceKey)) {
        const reset = await runResetAfterMutation(roundNumber, boardSliceKey);
        if (!reset.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(reset.error);
          return;
        }
        next = reset.bracket;
        setBracket(next);
      }
      const rs = await runReassignMutation(roundNumber, operations, boardSliceKey);
      if (!rs.ok) {
        rollbackLastUndoSnapshot();
        setSaveState("error");
        setMessage(rs.error);
        return;
      }
      next = rs.bracket;
      if (hasDownstreamRounds(bracket, roundNumber, boardSliceKey)) {
        const rebuilt = await runRebuildFromRoundMutation(roundNumber, boardSliceKey);
        if (!rebuilt.ok) {
          rollbackLastUndoSnapshot();
          setSaveState("error");
          setMessage(rebuilt.error);
          return;
        }
        next = rebuilt.bracket;
      }
      setBracket(next);
      setSaveState("saved");
      setMessage("현재 라운드 재배치가 완료되었습니다.");
    } catch {
      rollbackLastUndoSnapshot();
      setSaveState("error");
      setMessage("현재 라운드 재배치 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">
        자동배정/수동배정에서 임시 배정 후 미리보기에서 확인하고, 확정 저장 시점에만 실제 대진표가 반영됩니다.
      </p>

      {zonesEnabled ? (
        <section className="v3-box v3-stack" style={{ padding: "0.65rem 0.75rem" }}>
          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>권역</span>
            <select
              className="v3-btn"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={zoneOptions.length === 0}
              style={{ minHeight: 36, fontWeight: 600 }}
            >
              {zoneOptions.length === 0 ? <option value="">권역 없음</option> : null}
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneName}
                </option>
              ))}
            </select>
          </div>
          <p className="v3-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
            권역 운영 대회는 아래에서 권역을 선택한 뒤 대진표를 다룹니다. 기존{" "}
            <code>/api/client/tournaments/…/bracket</code> 단일 조회는 이 화면에서 사용하지 않습니다.
          </p>
        </section>
      ) : null}

      {bracket && (!zonesEnabled || selectedZoneId) ? (
        <section className="v3-box v3-stack" style={{ padding: "0.55rem 0.75rem" }} aria-label="대진표 편집 도구">
          <div className="v3-stack" style={{ gap: "0.45rem" }}>
            <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {canSplitBracket(bracket) ? (
              <>
                <label className="v3-stack" style={{ gap: "0.2rem", minWidth: "12rem" }}>
                  <span style={{ fontWeight: 700 }}>대진표 분할 인원</span>
                  <span className="v3-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                    한 조에 들어갈 참가자 수를 입력하세요
                  </span>
                  <input
                    type="number"
                    min={2}
                    step={2}
                    className="v3-btn"
                    style={{ width: "5rem", minHeight: 34 }}
                    value={multiBlockSize}
                    onChange={(e) => setMultiBlockSize(Math.max(2, Math.floor(Number(e.target.value)) || 16))}
                    disabled={interactionLocked}
                  />
                </label>
                <button
                  type="button"
                  className="v3-btn"
                  disabled={
                    actionLoading ||
                    interactionLocked ||
                    multiBlockBusy ||
                    projectedQualifierBlockCount(bracket, multiBlockSize) < 4
                  }
                  title={
                    projectedQualifierBlockCount(bracket, multiBlockSize) < 4
                      ? "분할 후 결선이 최소 준결승(4강) 이상이 되려면 조가 4개 이상이어야 합니다."
                      : undefined
                  }
                  onClick={() => {
                    if (
                      !window.confirm(
                        "분할 시 상위 라운드는 초기화됩니다.\n단일 대진표가 예선 조와 결선 구조로 바뀝니다. 계속하시겠습니까?",
                      )
                    ) {
                      return;
                    }
                    void (async () => {
                      setMultiBlockBusy(true);
                      setMessage("");
                      try {
                        const res = await fetch(
                          `/api/client/tournaments/${tournamentId}/bracket/multi-block${bracketZoneQuery}`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify({ blockSize: multiBlockSize }),
                          },
                        );
                        const json = (await res.json()) as { bracket?: Bracket; error?: string };
                        if (!res.ok || !json.bracket) {
                          setMessage(json.error ?? "대진표 분할에 실패했습니다.");
                          return;
                        }
                        setBracket(json.bracket);
                        setMessage("대진표를 분할했습니다.");
                      } finally {
                        setMultiBlockBusy(false);
                      }
                    })();
                  }}
                >
                  대진표 분할
                </button>
                {projectedQualifierBlockCount(bracket, multiBlockSize) < 4 ? (
                  <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                    분할 후 결선이 최소 준결승(4강) 이상이 되려면 조가 4개 이상이어야 합니다.
                  </span>
                ) : null}
                {splitPreviewLine ? (
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>{splitPreviewLine}</span>
                ) : null}
              </>
            ) : null}
            </div>
            <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
              다시 셔플은 빠른 결과 입력에서 실행할 수 있습니다.
            </span>
          </div>
        </section>
      ) : null}

      <section id="confirmed-bracket" ref={confirmedSectionRef} className="v3-box v3-stack">
        <h2 className="v3-h2">현재 확정 대진표 (최신 1개)</h2>
        {zonesEnabled && !selectedZoneId ? (
          <p className="v3-muted">권역을 선택해야 대진표를 볼 수 있습니다.</p>
        ) : !bracket ? (
          <p className="v3-muted">아직 확정된 대진표가 없습니다.</p>
        ) : (
          <>
            <BracketProgressSummaryCard bracket={bracket} />
            {bracket.bracketMode === "multi_block" && bracket.blocks?.length ? (
              <div
                className="v3-row"
                style={{ gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.5rem" }}
              >
                {bracket.blocks.map((bl) => (
                  <button
                    key={bl.id}
                    type="button"
                    className={boardSliceKey === `block:${bl.id}` ? "ui-btn-primary-solid" : "v3-btn"}
                    onClick={() => setBoardSliceKey(`block:${bl.id}`)}
                  >
                    조 {bl.label ?? bl.id}
                  </button>
                ))}
                {bracket.finalBlock?.rounds?.length ? (
                  <button
                    type="button"
                    className={boardSliceKey === "final" ? "ui-btn-primary-solid" : "v3-btn"}
                    onClick={() => setBoardSliceKey("final")}
                  >
                    결선
                  </button>
                ) : null}
              </div>
            ) : null}

            <section className="v3-box v3-stack" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} aria-label="빠른 결과 입력">
              <h3 className="v3-h2" style={{ fontSize: "1rem", margin: 0 }}>
                빠른 결과 입력
              </h3>
              <p className="v3-muted" style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.82rem" }}>
                아래 목록은 확정 대진표(rounds)와 동일한 데이터를 표시합니다. 보조 입력 도구입니다.
              </p>
              <div className="v3-stack" style={{ gap: "0.35rem" }}>
                {displayRoundsSorted.map((round) => {
                  const strengthLabel = roundLabelFromMatchCount(round.matches.length);
                  const shuffleBlockedReason = getShuffleRoundBlockedReason(sliceRoundsForShuffleGuard, round.roundNumber);
                  const listOpen = listOpenRoundNumber === round.roundNumber;
                  return (
                    <div
                      key={`list-${bracket.id}-${boardSliceKey ?? "root"}-${round.roundNumber}`}
                      className="v3-box v3-stack"
                      style={{ padding: "0.45rem 0.55rem", background: "#fff", border: "1px solid #e2e8f0" }}
                    >
                      <div className="v3-row" style={{ gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className="v3-btn"
                          style={{ flex: "1 1 12rem", justifyContent: "flex-start", fontWeight: 700 }}
                          onClick={() =>
                            setListOpenRoundNumber((prev) => (prev === round.roundNumber ? null : round.roundNumber))
                          }
                        >
                          [{strengthLabel}] Round {round.roundNumber}{" "}
                          <span className="v3-muted" style={{ fontWeight: 600 }}>
                            ({listOpen ? "접기" : "펼치기"})
                          </span>
                        </button>
                        <button
                          type="button"
                          className="v3-btn"
                          disabled={
                            !!shuffleBlockedReason ||
                            actionLoading ||
                            interactionLocked ||
                            multiBlockBusy ||
                            round.matches.length === 0
                          }
                          title={shuffleBlockedReason ?? undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              !window.confirm(
                                `「${strengthLabel}」라운드를 다시 셔플합니다. 계속하시겠습니까?`,
                              )
                            ) {
                              return;
                            }
                            void executeRoundShuffle(round.roundNumber);
                          }}
                        >
                          다시 셔플
                        </button>
                      </div>
                      {listOpen && round.matches.length > 0 ? (
                        <div style={{ marginTop: "0.5rem", overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                            <tbody>
                              {round.matches.map((match, idx) => (
                                <tr key={match.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                                  <td style={{ padding: "0.35rem 0.45rem", whiteSpace: "nowrap", fontWeight: 700 }}>
                                    {idx + 1}조
                                  </td>
                                  <td style={{ padding: "0.35rem 0.45rem" }}>{match.player1.name}</td>
                                  <td style={{ padding: "0.35rem 0.25rem", whiteSpace: "nowrap" }}>
                                    <button
                                      type="button"
                                      className="v3-btn"
                                      style={{ minHeight: 30, padding: "0.2rem 0.45rem" }}
                                      onClick={() => handleSetWinner(match.id, match.player1.userId, round.roundNumber)}
                                      disabled={actionLoading || interactionLocked}
                                    >
                                      승
                                    </button>
                                  </td>
                                  <td style={{ padding: "0.35rem 0.25rem", color: "#64748b" }}>vs</td>
                                  <td style={{ padding: "0.35rem 0.45rem" }}>{match.player2.name}</td>
                                  <td style={{ padding: "0.35rem 0.25rem", whiteSpace: "nowrap" }}>
                                    <button
                                      type="button"
                                      className="v3-btn"
                                      style={{ minHeight: 30, padding: "0.2rem 0.45rem" }}
                                      onClick={() => handleSetWinner(match.id, match.player2.userId, round.roundNumber)}
                                      disabled={actionLoading || interactionLocked}
                                    >
                                      승
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      {listOpen &&
                      round.status === "COMPLETED" &&
                      !displayRounds.some((nextRound) => nextRound.roundNumber === round.roundNumber + 1) ? (
                        <div className="v3-row" style={{ marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            className="v3-btn"
                            onClick={() => handleAdvanceRound(round.roundNumber)}
                            disabled={actionLoading || interactionLocked}
                          >
                            다음 라운드 생성
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="v3-row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="ui-btn-primary-solid"
                onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket/view${bracketZoneQuery}`)}
                style={{ padding: "0.6rem 1rem", fontWeight: 700 }}
              >
                대진표 보기
              </button>
              <button
                type="button"
                className="v3-btn"
                onClick={() => void handleUndo()}
                disabled={!canUndo}
                title={!undoStack.length ? "되돌릴 변경이 없습니다." : undefined}
              >
                되돌리기
              </button>
              <p className="v3-muted" style={{ margin: 0 }}>
                운영판은 전체화면 대진표 보기 페이지에서 제공합니다.
              </p>
            </div>
            <p>
              <strong>대진표 ID:</strong> {bracket.id}
            </p>
            {bracket.zoneId ? (
              <p>
                <strong>권역:</strong> {bracket.zoneId}
              </p>
            ) : null}
            <p>
              <strong>생성 시각:</strong> {new Date(bracket.createdAt).toLocaleString("ko-KR")}
            </p>
          </>
        )}
      </section>

      {saveStateText || message ? (
        <p className="v3-muted">
          {saveStateText}
          {saveStateText && message ? " · " : ""}
          {message}
        </p>
      ) : null}

      <section className="v3-box v3-stack" aria-label="인쇄용 대진표">
        <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <h2 className="v3-h2" style={{ margin: 0 }}>인쇄용 대진표</h2>
          <button
            type="button"
            className="v3-btn"
            onClick={() => setPrintToolsOpen((prev) => !prev)}
          >
            {printToolsOpen ? "닫기" : "열기"}
          </button>
        </div>
        {printToolsOpen ? (
          <TournamentGroupRound1PrintClient tournamentId={tournamentId} />
        ) : (
          <p className="v3-muted" style={{ margin: 0 }}>
            운영판과 분리된 인쇄 전용 화면입니다. 필요할 때 열어 사용하세요.
          </p>
        )}
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">작성 기준 참가자</h2>
        {!snapshot ? (
          <p className="v3-muted">아직 고정된 참가자 목록이 없습니다. 새 대진표가 필요하면 아래에서 생성하거나 자동·수동 배정 화면을 이용하세요.</p>
        ) : (
          <>
            <p>
              <strong>참가자 수:</strong> {snapshot.participants.length}명
            </p>
            <p>
              <strong>고정 시각:</strong> {new Date(snapshot.createdAt).toLocaleString("ko-KR")}
            </p>
          </>
        )}
      </section>

      {!bracket ? (
        <>
          <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link
              prefetch={false}
              className="v3-btn"
              href={`/client/tournaments/${tournamentId}/bracket/create${bracketZoneQuery}`}
              aria-disabled={zonesEnabled && !selectedZoneId}
              style={zonesEnabled && !selectedZoneId ? { pointerEvents: "none", opacity: 0.45 } : undefined}
            >
              대진표 생성
            </Link>
            <Link
              prefetch={false}
              className="v3-btn"
              href={`/client/tournaments/${tournamentId}/bracket/auto${bracketZoneQuery}`}
              aria-disabled={zonesEnabled && !selectedZoneId}
              style={zonesEnabled && !selectedZoneId ? { pointerEvents: "none", opacity: 0.45 } : undefined}
            >
              자동배정
            </Link>
            <Link
              prefetch={false}
              className="v3-btn"
              href={`/client/tournaments/${tournamentId}/bracket/manual${bracketZoneQuery}`}
              aria-disabled={zonesEnabled && !selectedZoneId}
              style={zonesEnabled && !selectedZoneId ? { pointerEvents: "none", opacity: 0.45 } : undefined}
            >
              수동배정
            </Link>
          </div>
        </>
      ) : null}

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">기준 참가자 명단</h2>
        {!snapshot ? (
          <p className="v3-muted">고정된 참가자 목록이 없어 표시할 수 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {snapshot.participants.map((participant, index) => (
              <li key={`${snapshot.id}-${participant.userId}-${index}`}>
                {participant.applicantName} / {participant.phone}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
