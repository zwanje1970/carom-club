"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  findBracketMatchLocation as findBracketMatchLocationForSync,
  getSliceRoundsFromBracket as getSliceRoundsForWinnerSync,
  hasDownstreamRoundsInSlice as hasDownstreamRoundsInSliceForWinnerSync,
  syncClearMatchWinner,
  syncRenamePlayer,
  syncSwapPlayers,
  syncWinnerPick,
  type BracketLike,
  type MutationFns,
} from "./bracket-view-server-sync";
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
} from "./bracket-offline-cache";
import BracketProgressSummaryCard from "./BracketProgressSummaryCard";
import TournamentTvLinkBlock from "../TournamentTvLinkBlock";
import "../tournament-manage-ui.css";
import { roundLabelFromMatchCount } from "./bracket-progress-utils";

const TournamentGroupRound1PrintClient = dynamic(
  () => import("./TournamentGroupRound1PrintClient"),
  { ssr: false, loading: () => <p className="v3-muted">조별 1차 대진표 인쇄 도구를 불러오는 중…</p> },
);

type BracketRoundDoc = {
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

function collectBracketRoundDocs(b: Bracket): BracketRoundDoc[] {
  if (b.bracketMode === "multi_block") {
    const out: BracketRoundDoc[] = [];
    for (const bl of b.blocks ?? []) {
      out.push(...bl.rounds);
    }
    if (b.finalBlock?.rounds?.length) out.push(...b.finalBlock.rounds);
    return out;
  }
  return b.rounds;
}

/** 승자 확정 등 대진표 구조 변경을 유발한 기록이 있는지(클라이언트 잠금 판단용) */
function bracketHasAnyRecordedWinner(b: Bracket | null): boolean {
  if (!b) return false;
  const scan = (rounds: BracketRoundDoc[]) => {
    for (const r of rounds) {
      for (const m of r.matches) {
        const w = typeof m.winnerUserId === "string" ? m.winnerUserId.trim() : "";
        if (w !== "" && !w.startsWith("__")) return true;
      }
    }
    return false;
  };
  return scan(collectBracketRoundDocs(b));
}

function BracketHubAccordionPanel({
  sectionId,
  title,
  summary,
  expanded,
  onToggle,
  headerTone,
  children,
}: {
  sectionId: string;
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  headerTone?: "default" | "danger";
  children: ReactNode;
}) {
  const danger = headerTone === "danger";
  return (
    <section className="v3-stack" style={{ gap: "0.35rem" }} aria-labelledby={`${sectionId}-heading`}>
      <button
        type="button"
        id={`${sectionId}-heading`}
        aria-expanded={expanded}
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem",
          textAlign: "left",
          padding: "0.55rem 0.65rem",
          borderRadius: "8px",
          border: danger ? "2px solid #dc2626" : "1px solid #cbd5e1",
          background: danger ? "#fff7ed" : "#fff",
          boxShadow: "none",
          cursor: "pointer",
        }}
      >
        <span className="v3-stack" style={{ gap: "0.15rem", margin: 0, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: "1.02rem",
              color: danger ? "#991b1b" : "#0f172a",
              wordBreak: "keep-all",
            }}
          >
            {title}
          </span>
          {summary ? (
            <span className="v3-muted" style={{ fontSize: "0.78rem", margin: 0, lineHeight: 1.35, color: danger ? "#7f1d1d" : undefined }}>
              {summary}
            </span>
          ) : null}
        </span>
        <span aria-hidden style={{ fontWeight: 800, color: danger ? "#991b1b" : "#64748b", flexShrink: 0 }}>
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded ? (
        <div className="v3-stack" style={{ gap: "0.65rem", paddingLeft: "0.15rem" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

type BracketHubAccordionKey = "auto" | "ops" | "field" | "danger";

function rootRoundOneSlotCount(b: Bracket): number {
  const r1 = b.rounds.find((r) => r.roundNumber === 1);
  if (!r1) return 0;
  return r1.matches.length * 2;
}

const PRINT_START_SIZES = [16, 32, 64, 128] as const;

function toAllowedPrintStartSize(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 32;
  for (const a of PRINT_START_SIZES) {
    if (a >= n) return a;
  }
  return 128;
}

function countSliceFilledSlotsRoundOne(sliceRounds: BracketRoundDoc[]): number {
  const r1 = sliceRounds.find((r) => r.roundNumber === 1);
  if (!r1) return 0;
  let c = 0;
  for (const m of r1.matches) {
    const filled = (p: { userId?: string; name?: string; displayName?: string | null }) => {
      const uid = (p?.userId ?? "").trim();
      if (uid.startsWith("__")) return false;
      const nm = (p?.displayName ?? p?.name ?? "").trim();
      return uid !== "" || nm !== "";
    };
    if (filled(m.player1)) c++;
    if (filled(m.player2)) c++;
  }
  return c;
}

/** 인쇄용 시작 강수: 단일 대진표는 저장 슬롯 수, 조·결선은 해당 슬라이스 1라운드 실제·구조 기준 */
function printStartPlayersHintFromBracket(b: Bracket | null, sliceKey: string | null): number | null {
  if (!b) return null;
  const sliceRounds = getSliceRoundsFromBracket(b, sliceKey);
  if (!sliceRounds.length) return null;
  const r1 = sliceRounds.find((r) => r.roundNumber === 1);
  const structural = (r1?.matches.length ?? 0) * 2;
  const counted = countSliceFilledSlotsRoundOne(sliceRounds);

  if (b.bracketMode === "multi_block" && (sliceKey?.startsWith("block:") || sliceKey === "final")) {
    const basis = Math.max(counted, structural);
    return toAllowedPrintStartSize(basis > 0 ? basis : 32);
  }

  const slots = rootRoundOneSlotCount(b);
  if (slots <= 0) return null;
  return toAllowedPrintStartSize(slots);
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

function defaultBoardSliceKey(b: Bracket | null): string | null {
  if (!b || b.bracketMode !== "multi_block" || !b.blocks?.[0]) return null;
  return `block:${b.blocks[0].id}`;
}

function bracketSlotLabel(p: { name: string; displayName?: string | null }): string {
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  return d || p.name;
}

/** 조분할 입력값 문자열 → 숫자 (미입력·숫자 아님은 null). 실행 시점 검증용. */
function parseMultiBlockSplitSizeDraft(draft: string): number | null {
  const t = draft.trim();
  if (!t) return null;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function BracketManageClient({ variant = "full" }: { variant?: "full" | "quickResults" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);
  const [bracket, setBracket] = useState<Bracket | null>(null);
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
  const [zoneResetModalOpen, setZoneResetModalOpen] = useState(false);
  const [fullResetWarnOpen, setFullResetWarnOpen] = useState(false);
  const [fullResetPasswordOpen, setFullResetPasswordOpen] = useState(false);
  const [fullResetPasswordInput, setFullResetPasswordInput] = useState("");
  const [fullResetPasswordError, setFullResetPasswordError] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [boardSliceKey, setBoardSliceKey] = useState<string | null>(null);
  const [multiBlockSizeDraft, setMultiBlockSizeDraft] = useState("16");
  const [multiBlockBusy, setMultiBlockBusy] = useState(false);
  const [selectedQuickRoundNumber, setSelectedQuickRoundNumber] = useState<number | null>(null);
  const confirmedSectionRef = useRef<HTMLDivElement | null>(null);
  const didInitialBoardFocusRef = useRef(false);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);
  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingActionKeysRef = useRef<Set<string>>(new Set());
  const bracketRef = useRef<Bracket | null>(null);
  const replayRunningRef = useRef(false);
  const sliceMetaRefManage = useRef<{ bracketId: string; blockSig: string }>({ bracketId: "", blockSig: "" });
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [bracketSyncBusy, setBracketSyncBusy] = useState(false);
  const storageSeg = useMemo(() => bracketOfflineSegment(zonesEnabled, selectedZoneId), [zonesEnabled, selectedZoneId]);

  useLayoutEffect(() => {
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

  useEffect(() => {
    if (!bracket) {
      setBoardSliceKey(null);
      sliceMetaRefManage.current = { bracketId: "", blockSig: "" };
      return;
    }
    if (bracket.bracketMode !== "multi_block" || !bracket.blocks?.[0]) {
      setBoardSliceKey(null);
      sliceMetaRefManage.current = { bracketId: bracket.id, blockSig: "" };
      return;
    }
    const blockSig = bracket.blocks.map((b) => b.id).join("|");
    const prevM = sliceMetaRefManage.current;
    const structuralChange = prevM.bracketId !== bracket.id || prevM.blockSig !== blockSig;
    sliceMetaRefManage.current = { bracketId: bracket.id, blockSig };
    const ids = new Set(bracket.blocks.map((b) => b.id));
    setBoardSliceKey((prevKey) => {
      if (!structuralChange) {
        if (prevKey === "final" && bracket.finalBlock?.rounds?.length) return prevKey;
        if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
          const bid = prevKey.slice("block:".length);
          if (ids.has(bid)) return prevKey;
        }
        return prevKey;
      }
      return defaultBoardSliceKey(bracket);
    });
  }, [bracket]);

  const displayRounds = useMemo(() => {
    if (!bracket) return [];
    return getSliceRoundsFromBracket(bracket, boardSliceKey);
  }, [bracket, boardSliceKey]);

  const selectedQualifierBlockId = useMemo(() => {
    if (!boardSliceKey?.startsWith("block:")) return null;
    return boardSliceKey.slice("block:".length);
  }, [boardSliceKey]);

  const splitPreviewLine = useMemo(() => {
    if (!bracket || !canSplitBracket(bracket)) return null;
    const total = rootRoundOneSlotCount(bracket);
    const n = parseMultiBlockSplitSizeDraft(multiBlockSizeDraft);
    if (total <= 0 || n == null || n < 2) return null;
    const groups = projectedQualifierBlockCount(bracket, n);
    return `총 ${total}명 → ${n}명씩 → ${groups}개 조 생성`;
  }, [bracket, multiBlockSizeDraft]);

  const splitParsedBlockSize = useMemo(() => parseMultiBlockSplitSizeDraft(multiBlockSizeDraft), [multiBlockSizeDraft]);

  const displayRoundsSorted = useMemo(
    () => [...displayRounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [displayRounds],
  );

  useEffect(() => {
    if (!displayRoundsSorted.length) {
      setSelectedQuickRoundNumber(null);
      return;
    }
    setSelectedQuickRoundNumber((prev) => {
      if (prev != null && displayRoundsSorted.some((r) => r.roundNumber === prev)) return prev;
      return displayRoundsSorted[0]!.roundNumber;
    });
  }, [displayRoundsSorted]);

  const bracketHasRecordedWinners = useMemo(() => bracketHasAnyRecordedWinner(bracket), [bracket]);

  const hubOperatePhase = useMemo(() => {
    if (!bracket) return false;
    if (bracket.bracketMode === "multi_block") return true;
    return bracketHasRecordedWinners;
  }, [bracket, bracketHasRecordedWinners]);

  const suggestedAccordionOpen = useMemo(
    () => ({
      auto: !hubOperatePhase,
      ops: hubOperatePhase,
      field: hubOperatePhase,
      danger: false,
    }),
    [hubOperatePhase],
  );

  const [accordionOverride, setAccordionOverride] = useState<Partial<Record<BracketHubAccordionKey, boolean>>>({});

  useEffect(() => {
    setAccordionOverride({});
  }, [bracket?.id, selectedZoneId]);

  const isAccordionOpen = useCallback(
    (key: BracketHubAccordionKey) => {
      const o = accordionOverride[key];
      if (typeof o === "boolean") return o;
      return suggestedAccordionOpen[key];
    },
    [accordionOverride, suggestedAccordionOpen],
  );

  const toggleAccordion = useCallback(
    (key: BracketHubAccordionKey) => {
      setAccordionOverride((prev) => {
        const cur = typeof prev[key] === "boolean" ? prev[key]! : suggestedAccordionOpen[key];
        return { ...prev, [key]: !cur };
      });
    },
    [suggestedAccordionOpen],
  );

  const hubAdvanceTargetRound = useMemo(() => {
    if (!bracket || displayRoundsSorted.length === 0) return null;
    const activeQuickRound =
      displayRoundsSorted.find((r) => r.roundNumber === selectedQuickRoundNumber) ?? displayRoundsSorted[0] ?? null;
    if (!activeQuickRound) return null;
    if (activeQuickRound.status !== "COMPLETED") return null;
    if (displayRounds.some((nextRound) => nextRound.roundNumber === activeQuickRound.roundNumber + 1)) return null;
    return activeQuickRound;
  }, [bracket, displayRoundsSorted, displayRounds, selectedQuickRoundNumber]);

  const pullManageBracket = useCallback(async (): Promise<
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

  const loadLatestBracket = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      return;
    }
    const seg = storageSeg;
    const cached = readLastGoodBracket<Bracket>(tournamentId, seg);
    if (cached) {
      setBracket(cached);
    }
    const pulled = await pullManageBracket();
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
  }, [pullManageBracket, storageSeg, tournamentId, zonesEnabled, selectedZoneId]);

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
    void loadLatestBracket();
  }, [loadLatestBracket]);

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
  const saveStateText = saveState === "saving" ? "저장 중..." : saveState === "error" ? "오류 발생" : "";
  const connectivityHint = !navigatorOnline ? "오프라인" : bracketSyncBusy ? "연결 복구 중" : "";

  const enqueueMutation = useCallback(
    (actionKey: string, runner: () => Promise<void>, options?: { quiet?: boolean }) => {
      if (pendingActionKeysRef.current.has(actionKey)) return;
      pendingActionKeysRef.current.add(actionKey);
      const quiet = options?.quiet === true;
      actionQueueRef.current = actionQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!quiet) {
            setActionLoading(true);
            setSaveState("saving");
          }
          try {
            await runner();
          } finally {
            pendingActionKeysRef.current.delete(actionKey);
            if (!quiet) {
              setActionLoading(false);
            }
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

  const mutationFnsQuick = useMemo<MutationFns>(
    () => ({
      patchMatchResult: async (matchId, winnerUserId) => runMatchResultMutation(matchId, winnerUserId),
      advanceRound: async (roundNumber, sliceKey) =>
        runAdvanceRoundMutation(roundNumber, sliceKey ?? boardSliceKey),
      resetAfter: async (roundNumber, sliceKey) => runResetAfterMutation(roundNumber, sliceKey ?? boardSliceKey),
      rebuildFromRound: async (roundNumber, sliceKey) =>
        runRebuildFromRoundMutation(roundNumber, sliceKey ?? boardSliceKey),
      reassign: async (roundNumber, operations, sliceKey) =>
        runReassignMutation(roundNumber, operations, sliceKey ?? boardSliceKey),
      renamePlayer: async (matchId, slot, displayName) => runRenamePlayerMutation(matchId, slot, displayName),
    }),
    [
      boardSliceKey,
      runAdvanceRoundMutation,
      runMatchResultMutation,
      runRebuildFromRoundMutation,
      runReassignMutation,
      runRenamePlayerMutation,
      runResetAfterMutation,
    ],
  );

  const hasDownstreamForSync = useCallback(
    (b: BracketLike, roundNumber: number, sliceKey: string | null) =>
      hasDownstreamRounds(b as Bracket, roundNumber, sliceKey),
    [hasDownstreamRounds],
  );

  const replayOfflinePendingManage = useCallback(async () => {
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
            mut: mutationFnsQuick,
            hasDownstream: hasDownstreamForSync,
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
            mut: mutationFnsQuick,
            hasDownstream: hasDownstreamForSync,
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
            mut: mutationFnsQuick,
            hasDownstream: hasDownstreamForSync,
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
            mut: mutationFnsQuick,
            hasDownstream: hasDownstreamForSync,
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
    hasDownstreamForSync,
    mutationFnsQuick,
    pullManageBracket,
    selectedZoneId,
    storageSeg,
    tournamentId,
    zonesEnabled,
  ]);

  useEffect(() => {
    const run = () => {
      void replayOfflinePendingManage();
    };
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [replayOfflinePendingManage]);

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
      void replayOfflinePendingManage();
    }, 350);
    return () => window.clearTimeout(t);
  }, [replayOfflinePendingManage, selectedZoneId, storageSeg, tournamentId, zonesEnabled]);

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
        setSaveState("idle");
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
      setSaveState("idle");
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

  /** 빠른결과: 해당 경기 승패 결과 취소(히스토리 Undo 아님). 온라인은 서버 최신 브래킷 기준. */
  const handleQuickClearMatchResult = useCallback(
    async (
      matchId: string,
      rowCtx?: { roundNumber: number; boardSliceKey: string | null; rowIndex1Based: number },
    ) => {
      const trimmedId = matchId.trim();
      if (!tournamentId || interactionLocked || !trimmedId) return;
      enqueueMutation(`clearResult:${trimmedId}`, async () => {
        const seg = storageSeg;
        setMessage("");
        try {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            const snap = bracketRef.current as BracketLike | null;
            if (!snap) {
              console.warn("[quick-results clear-match-result] bracketRef null (offline)", {
                matchId: trimmedId,
                rowCtx,
              });
              setSaveState("error");
              setMessage("대진표 데이터가 없습니다.");
              return;
            }
            const locOff = findBracketMatchLocationForSync(snap, trimmedId);
            if (!locOff) {
              console.warn("[quick-results clear-match-result] match not found (offline)", {
                matchId: trimmedId,
                rowCtx,
                bracketId: snap.id,
              });
              setSaveState("error");
              setMessage("대상 매치를 찾을 수 없습니다.");
              return;
            }
            const next = applyLocalClearWinner(snap, trimmedId);
            if (!next) {
              setSaveState("error");
              setMessage("진출을 취소할 수 없습니다.");
              return;
            }
            setBracket(next as Bracket);
            writeLastGoodBracket(tournamentId, seg, next as Bracket);
            appendOfflinePending(tournamentId, seg, { type: "clear_winner", matchId: trimmedId });
            setOfflineDirty(tournamentId, seg, true);
            setSaveState("idle");
            setMessage("");
            return;
          }

          const pulled = await pullManageBracket();
          if (!pulled.ok) {
            setSaveState("error");
            setMessage(pulled.error ?? "대진표를 불러오지 못했습니다.");
            return;
          }
          const serverBracket = pulled.bracket;
          if (!serverBracket) {
            setSaveState("error");
            setMessage("확정 대진표가 없습니다.");
            return;
          }

          const loc = findBracketMatchLocationForSync(serverBracket as BracketLike, trimmedId);
          if (!loc) {
            console.warn("[quick-results clear-match-result] match not found on server bracket", {
              matchId: trimmedId,
              rowCtx,
              bracketId: serverBracket.id,
            });
            setSaveState("error");
            setMessage("대상 매치를 찾을 수 없습니다.");
            return;
          }
          if (rowCtx) {
            if (loc.round.roundNumber !== rowCtx.roundNumber) {
              console.warn("[quick-results clear-match-result] roundNumber mismatch (row vs server)", {
                matchId: trimmedId,
                rowCtx,
                serverRoundNumber: loc.round.roundNumber,
              });
            }
            if ((loc.sliceKey ?? null) !== (rowCtx.boardSliceKey ?? null)) {
              console.warn("[quick-results clear-match-result] sliceKey mismatch (tab vs server)", {
                matchId: trimmedId,
                rowCtx,
                serverSliceKey: loc.sliceKey,
              });
            }
          }

          const hadWinner =
            typeof loc.match.winnerUserId === "string" && loc.match.winnerUserId.trim() !== "";
          if (!hadWinner) {
            setBracket(serverBracket);
            writeLastGoodBracket(tournamentId, seg, serverBracket);
            setOfflineDirty(tournamentId, seg, false);
            setSaveState("idle");
            setMessage("");
            return;
          }

          const rs = await syncClearMatchWinner({
            bracket: serverBracket as BracketLike,
            matchId: trimmedId,
            mut: mutationFnsQuick,
            hasDownstream: (b, roundNumber, sliceKey) =>
              hasDownstreamRoundsInSliceForWinnerSync(getSliceRoundsForWinnerSync(b, sliceKey), roundNumber),
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
          const fallback = bracketRef.current as BracketLike | null;
          const next = fallback ? applyLocalClearWinner(fallback, trimmedId) : null;
          if (next) {
            setBracket(next as Bracket);
            writeLastGoodBracket(tournamentId, seg, next as Bracket);
            appendOfflinePending(tournamentId, seg, { type: "clear_winner", matchId: trimmedId });
            setOfflineDirty(tournamentId, seg, true);
            setSaveState("idle");
            setMessage("");
            return;
          }
          setSaveState("error");
          setMessage("승패 결과 취소 중 오류가 발생했습니다.");
        }
      });
    },
    [enqueueMutation, interactionLocked, mutationFnsQuick, pullManageBracket, storageSeg, tournamentId],
  );

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

    const seg = storageSeg;
    const roundNoForPending = typeof roundNumber === "number" ? roundNumber : currentRound.roundNumber;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (changingWinner) {
        setMessage("승자 변경은 네트워크 연결 후 진행해 주세요.");
        return;
      }
      const next = applyLocalWinnerPick(current as unknown as BracketLike, matchId, winnerUserId);
      if (!next) {
        setMessage("경기 결과를 반영할 수 없습니다.");
        return;
      }
      bumpBracketLocalAuthorityRev(tournamentId, seg);
      setBracket(next as Bracket);
      writeLastGoodBracket(tournamentId, seg, next as Bracket);
      appendOfflinePending(tournamentId, seg, {
        type: "winner_pick",
        matchId,
        winnerUserId,
        roundNumber: roundNoForPending,
      });
      setOfflineDirty(tournamentId, seg, true);
      setSaveState("idle");
      setMessage("");
      return;
    }

    const mustResetDownstreamOnline =
      changingWinner && hasDownstreamRounds(current, currentRound.roundNumber, winSliceKey);

    if (mustResetDownstreamOnline) {
      enqueueMutation(`winner:${matchId}`, async () => {
        setMessage("");
        try {
          const resetResult = await runResetAfterMutation(currentRound.roundNumber, winSliceKey);
          if (!resetResult.ok) {
            setSaveState("error");
            setMessage(resetResult.error);
            return;
          }
          setBracket(resetResult.bracket);

          const result = await runMatchResultMutation(matchId, winnerUserId);
          if (!result.ok) {
            setSaveState("error");
            setMessage(result.error);
            return;
          }
          let nextBracket = result.bracket;
          const rebuildResult = await runRebuildFromRoundMutation(currentRound.roundNumber, winSliceKey);
          if (!rebuildResult.ok) {
            setSaveState("error");
            setMessage(rebuildResult.error);
            return;
          }
          nextBracket = rebuildResult.bracket;
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
            } else {
              bumpBracketLocalAuthorityRev(tournamentId, seg);
              setBracket(nextBracket);
              writeLastGoodBracket(tournamentId, seg, nextBracket);
              const finalProcessedEarly = await processFinalCompletion(nextBracket);
              if (!finalProcessedEarly) {
                setSaveState("error");
                setMessage(advResult.error);
              }
              return;
            }
          }
          bumpBracketLocalAuthorityRev(tournamentId, seg);
          setBracket(nextBracket);
          writeLastGoodBracket(tournamentId, seg, nextBracket);
          setOfflineDirty(tournamentId, seg, false);
          const finalProcessed = await processFinalCompletion(nextBracket);
          if (!finalProcessed) {
            setSaveState("idle");
            setMessage("");
          }
        } catch {
          setSaveState("error");
          setMessage("네트워크 오류 · 승자 변경은 연결 후 다시 시도해 주세요.");
        }
      });
      return;
    }

    const before = current;
    const optimistic = applyLocalWinnerPick(before as unknown as BracketLike, matchId, winnerUserId);
    if (!optimistic) {
      setMessage("경기 결과를 반영할 수 없습니다.");
      return;
    }
    const localRev = bumpBracketLocalAuthorityRev(tournamentId, seg);
    setBracket(optimistic as Bracket);
    writeLastGoodBracket(tournamentId, seg, optimistic as Bracket);
    setOfflineDirty(tournamentId, seg, true);
    setSaveState("idle");
    setMessage("");

    enqueueMutation(
      `winner:${matchId}`,
      async () => {
        try {
          const result = await runMatchResultMutation(matchId, winnerUserId);
          if (!result.ok) {
            appendOfflinePending(tournamentId, seg, {
              type: "winner_pick",
              matchId,
              winnerUserId,
              roundNumber: roundNoForPending,
            });
            setSaveState("error");
            setMessage(result.error);
            return;
          }
          let nextBracket = result.bracket;
          if (changingWinner) {
            const rebuildResult = await runRebuildFromRoundMutation(currentRound.roundNumber, winSliceKey);
            if (!rebuildResult.ok) {
              appendOfflinePending(tournamentId, seg, {
                type: "winner_pick",
                matchId,
                winnerUserId,
                roundNumber: roundNoForPending,
              });
              setSaveState("error");
              setMessage(rebuildResult.error);
              return;
            }
            nextBracket = rebuildResult.bracket;
          }
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
            } else {
              if (readBracketLocalAuthorityRev(tournamentId, seg) === localRev) {
                setBracket(nextBracket);
                writeLastGoodBracket(tournamentId, seg, nextBracket);
              }
              const finalProcessedEarly = await processFinalCompletion(nextBracket);
              if (!finalProcessedEarly) {
                setSaveState("error");
                setMessage(advResult.error);
              }
              return;
            }
          }
          if (readBracketLocalAuthorityRev(tournamentId, seg) !== localRev) {
            return;
          }
          setBracket(nextBracket);
          writeLastGoodBracket(tournamentId, seg, nextBracket);
          setOfflineDirty(tournamentId, seg, false);
          const finalProcessed = await processFinalCompletion(nextBracket);
          if (!finalProcessed) {
            setSaveState("idle");
            setMessage("");
          }
        } catch {
          appendOfflinePending(tournamentId, seg, {
            type: "winner_pick",
            matchId,
            winnerUserId,
            roundNumber: roundNoForPending,
          });
          setOfflineDirty(tournamentId, seg, true);
          setSaveState("idle");
          setMessage("");
        }
      },
      { quiet: true },
    );
  }

  async function handleAdvanceRound(roundNumber: number) {
    if (!tournamentId || actionLoading) return;
    if (interactionLocked) {
      setMessage("종료된 대회는 라운드를 진행할 수 없습니다.");
      return;
    }
    if (!bracket) return;
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      const result = await runAdvanceRoundMutation(roundNumber, boardSliceKey);
      if (!result.ok) {
        setSaveState("error");
        setMessage(result.error);
        return;
      }
      setBracket(result.bracket);
      setSaveState("idle");
      setMessage("");
    } catch {
      setSaveState("error");
      setMessage("다음 라운드 생성 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function executeRoundShuffle(roundNumber: number) {
    if (!tournamentId || !bracket) return;
    if (bracket.bracketMode === "multi_block") {
      setMessage("조분할 상태에서는 대진표 생성/재생성을 사용할 수 없습니다. 전체 초기화 후 이용해 주세요.");
      return;
    }
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
      setMessage("");
    } finally {
      setMultiBlockBusy(false);
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
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let next = bracket;
      if (hasDownstreamRounds(next, args.roundNumber, swapSlice)) {
        const reset = await runResetAfterMutation(args.roundNumber, swapSlice);
        if (!reset.ok) {
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
        setSaveState("error");
        setMessage(swapped.error);
        return;
      }
      next = swapped.bracket;
      if (hasDownstreamRounds(bracket, args.roundNumber, swapSlice)) {
        const rebuilt = await runRebuildFromRoundMutation(args.roundNumber, swapSlice);
        if (!rebuilt.ok) {
          setSaveState("error");
          setMessage(rebuilt.error);
          return;
        }
        next = rebuilt.bracket;
      }
      setBracket(next);
      setSaveState("idle");
      setMessage("");
    } catch {
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
    const loc = findBracketMatchLocation(bracket, args.matchId);
    const renameSlice = loc?.sliceKey ?? null;
    if (bracket.bracketMode === "multi_block" && renameSlice === null) {
      setMessage("분할 대진표에서 매치 위치를 특정할 수 없습니다.");
      return;
    }
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      const renamed = await runRenamePlayerMutation(args.matchId, args.slot, nextName);
      if (!renamed.ok) {
        setSaveState("error");
        setMessage(renamed.error);
        return;
      }
      setBracket(renamed.bracket);
      setSaveState("idle");
      setMessage("");
    } catch {
      setSaveState("error");
      setMessage("선수 이름 수정 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleShuffleCurrentRound(roundNumber: number) {
    if (!bracket || actionLoading || interactionLocked) return;
    if (bracket.bracketMode === "multi_block") {
      setSaveState("error");
      setMessage("조분할 상태에서는 대진표 생성/재생성을 사용할 수 없습니다. 전체 초기화 후 이용해 주세요.");
      return;
    }
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
      setSaveState("idle");
      setMessage("재배치할 매치가 충분하지 않습니다.");
      return;
    }
    setActionLoading(true);
    setSaveState("saving");
    setMessage("");
    try {
      let next = bracket;
      if (hasDownstreamRounds(next, roundNumber, boardSliceKey)) {
        const reset = await runResetAfterMutation(roundNumber, boardSliceKey);
        if (!reset.ok) {
          setSaveState("error");
          setMessage(reset.error);
          return;
        }
        next = reset.bracket;
        setBracket(next);
      }
      const rs = await runReassignMutation(roundNumber, operations, boardSliceKey);
      if (!rs.ok) {
        setSaveState("error");
        setMessage(rs.error);
        return;
      }
      next = rs.bracket;
      if (hasDownstreamRounds(bracket, roundNumber, boardSliceKey)) {
        const rebuilt = await runRebuildFromRoundMutation(roundNumber, boardSliceKey);
        if (!rebuilt.ok) {
          setSaveState("error");
          setMessage(rebuilt.error);
          return;
        }
        next = rebuilt.bracket;
      }
      setBracket(next);
      setSaveState("idle");
      setMessage("");
    } catch {
      setSaveState("error");
      setMessage("현재 라운드 재배치 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitQualifierBlockReset() {
    if (!tournamentId || !selectedQualifierBlockId || dangerBusy) return;
    setDangerBusy(true);
    try {
      const res = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/bracket/reset-qualifier-block${bracketZoneQuery}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ blockId: selectedQualifierBlockId }),
        },
      );
      const json = (await res.json()) as { bracket?: Bracket; error?: string };
      if (!res.ok || !json.bracket) {
        window.alert(json.error ?? "초기화에 실패했습니다.");
        return;
      }
      setBracket(json.bracket);
      setZoneResetModalOpen(false);
      router.refresh();
    } finally {
      setDangerBusy(false);
    }
  }

  async function submitFullRevertAfterPassword() {
    if (!tournamentId || dangerBusy) return;
    const pw = fullResetPasswordInput.trim();
    if (!pw) {
      setFullResetPasswordError("비밀번호를 입력해 주세요.");
      return;
    }
    setDangerBusy(true);
    setFullResetPasswordError("");
    try {
      const v = await fetch("/api/client/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password: pw }),
      });
      const vj = (await v.json()) as { ok?: boolean; error?: string };
      if (!v.ok || !vj.ok) {
        setFullResetPasswordError(vj.error ?? "비밀번호가 일치하지 않습니다.");
        return;
      }
      const res = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/bracket/revert-multi-block${bracketZoneQuery}`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const json = (await res.json()) as { bracket?: Bracket; error?: string };
      if (!res.ok || !json.bracket) {
        window.alert(json.error ?? "전체 초기화에 실패했습니다.");
        return;
      }
      setBracket(json.bracket);
      setFullResetPasswordOpen(false);
      setFullResetWarnOpen(false);
      setFullResetPasswordInput("");
      setFullResetPasswordError("");
      router.refresh();
    } finally {
      setDangerBusy(false);
    }
  }

  if (variant === "quickResults") {
    const activeQuickRound =
      displayRoundsSorted.find((r) => r.roundNumber === selectedQuickRoundNumber) ?? displayRoundsSorted[0] ?? null;

    return (
      <main className="v3-page v3-stack" style={{ paddingTop: "0.25rem" }}>
        <div
          className="v3-row"
          style={{
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.4rem",
            marginBottom: "0.28rem",
          }}
        >
          <h1 className="v3-h2" style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.15rem)", fontWeight: 700 }}>
            빠른 결과 입력
          </h1>
          <button
            type="button"
            className="ui-btn-primary-solid"
            style={{
              padding: "0.4rem 0.65rem",
              fontWeight: 600,
              fontSize: "0.88rem",
              minHeight: "40px",
              boxShadow: "none",
            }}
            onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket/view${bracketZoneQuery}`)}
          >
            대진표 보기
          </button>
        </div>

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
          </section>
        ) : null}

        {zonesEnabled && !selectedZoneId ? (
          <p className="v3-muted">권역을 선택해야 합니다.</p>
        ) : !bracket ? (
          <p className="v3-muted">아직 확정된 대진표가 없습니다.</p>
        ) : (
          <>
            {bracket.bracketMode === "multi_block" && bracket.blocks?.length ? (
              <div
                className="v3-row"
                style={{ gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.4rem" }}
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

            <div className="v3-row" style={{ gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.45rem" }}>
              {displayRoundsSorted.map((round) => (
                <button
                  key={`qr-tab-${bracket.id}-${boardSliceKey ?? "root"}-${round.roundNumber}`}
                  type="button"
                  className={selectedQuickRoundNumber === round.roundNumber ? "ui-btn-primary-solid" : "v3-btn"}
                  onClick={() => setSelectedQuickRoundNumber(round.roundNumber)}
                >
                  {roundLabelFromMatchCount(round.matches.length)}
                </button>
              ))}
            </div>

            {activeQuickRound ? (
              <section className="v3-box v3-stack" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.5rem 0.55rem", gap: "0.35rem" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                    <tbody>
                      {activeQuickRound.matches.map((match, idx) => {
                        const p1Label = bracketSlotLabel(match.player1);
                        const p2Label = bracketSlotLabel(match.player2);
                        const done =
                          match.status === "COMPLETED" &&
                          typeof match.winnerUserId === "string" &&
                          match.winnerUserId.trim() !== "";
                        const p1Win = done && match.winnerUserId === match.player1.userId;
                        const p2Win = done && match.winnerUserId === match.player2.userId;
                        const pill = (label: string, bg: string, color: string) => (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 34,
                              padding: "0.25rem 0.55rem",
                              fontWeight: 700,
                              borderRadius: 8,
                              background: bg,
                              color,
                              boxSizing: "border-box",
                            }}
                          >
                            {label}
                          </span>
                        );
                        return (
                          <tr
                            key={match.id}
                            style={{
                              borderBottom: "1px solid rgba(15, 23, 42, 0.15)",
                            }}
                          >
                            <td style={{ padding: "0.35rem 0.45rem", whiteSpace: "nowrap", fontWeight: 700 }}>
                              {idx + 1}번
                            </td>
                            <td style={{ padding: "0.35rem 0.45rem" }}>{p1Label}</td>
                            <td style={{ padding: "0.35rem 0.25rem", whiteSpace: "nowrap" }}>
                              {p1Win
                                ? pill("승", "#22c55e", "#fff")
                                : p2Win
                                  ? pill("패", "#ef4444", "#fff")
                                  : (
                                      <button
                                        type="button"
                                        className="v3-btn"
                                        style={{ minHeight: 34, padding: "0.25rem 0.55rem", fontWeight: 700 }}
                                        onClick={() =>
                                          void handleSetWinner(match.id, match.player1.userId, activeQuickRound.roundNumber)
                                        }
                                        disabled={actionLoading || interactionLocked}
                                      >
                                        승
                                      </button>
                                    )}
                            </td>
                            <td style={{ padding: "0.35rem 0.25rem", color: "#64748b" }}>vs</td>
                            <td style={{ padding: "0.35rem 0.45rem" }}>{p2Label}</td>
                            <td style={{ padding: "0.35rem 0.25rem", whiteSpace: "nowrap" }}>
                              {p2Win
                                ? pill("승", "#22c55e", "#fff")
                                : p1Win
                                  ? pill("패", "#ef4444", "#fff")
                                  : (
                                      <button
                                        type="button"
                                        className="v3-btn"
                                        style={{ minHeight: 34, padding: "0.25rem 0.55rem", fontWeight: 700 }}
                                        onClick={() =>
                                          void handleSetWinner(match.id, match.player2.userId, activeQuickRound.roundNumber)
                                        }
                                        disabled={actionLoading || interactionLocked}
                                      >
                                        승
                                      </button>
                                    )}
                            </td>
                            <td style={{ padding: "0.35rem 0.25rem", whiteSpace: "nowrap", width: "3rem" }}>
                              <button
                                type="button"
                                className="v3-btn"
                                aria-label="이 경기 승패 결과 취소"
                                title="이 경기 승패 결과 취소"
                                disabled={!done || actionLoading || interactionLocked}
                                onClick={() =>
                                  void handleQuickClearMatchResult(match.id, {
                                    roundNumber: activeQuickRound.roundNumber,
                                    boardSliceKey,
                                    rowIndex1Based: idx + 1,
                                  })
                                }
                                style={{
                                  minWidth: 44,
                                  minHeight: 44,
                                  width: 44,
                                  height: 44,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.25rem",
                                  lineHeight: 1,
                                  borderRadius: "0.35rem",
                                }}
                              >
                                ↶
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {activeQuickRound.status === "COMPLETED" &&
                !displayRounds.some((nextRound) => nextRound.roundNumber === activeQuickRound.roundNumber + 1) ? (
                  <div className="v3-row" style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="v3-btn"
                      onClick={() => handleAdvanceRound(activeQuickRound.roundNumber)}
                      disabled={actionLoading || interactionLocked}
                    >
                      다음 라운드 생성
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
            {connectivityHint || saveStateText || message ? (
              <p className="v3-muted">
                {connectivityHint}
                {connectivityHint && (saveStateText || message) ? " · " : ""}
                {saveStateText}
                {saveStateText && message ? " · " : ""}
                {message}
              </p>
            ) : null}
          </>
        )}
      </main>
    );
  }

  const printStartPlayersHint = useMemo(
    () => printStartPlayersHintFromBracket(bracket, boardSliceKey),
    [bracket, boardSliceKey],
  );

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
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

      <div
        aria-label="대진표 자동생성"
        className="v3-stack"
        style={{
          gap: "0.35rem",
          padding: "0.85rem 1rem",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
          boxShadow: "none",
        }}
      >
        <BracketHubAccordionPanel
          sectionId="hub-auto"
          title="1. 대진표 자동생성"
          summary={
            !bracket
              ? "확정 전 · 만들기·분할 준비"
              : bracket.bracketMode === "multi_block"
                ? "조분할 됨 · 재배치는 단일로 복귀 후"
                : bracketHasRecordedWinners
                  ? "승패 기록됨 · 구조 변경 잠금"
                  : "생성/재생성·조분할 가능"
          }
          expanded={isAccordionOpen("auto")}
          onToggle={() => toggleAccordion("auto")}
        >
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            대진표 생성/재생성을 하시면 랜덤으로 대진표가 만들어집니다.
          </p>

        {zonesEnabled && !selectedZoneId ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            권역을 선택한 뒤 대진표 자동생성·분할을 이용할 수 있습니다.
          </p>
        ) : !bracket ? (
          <div className="v3-stack" style={{ gap: "0.5rem", width: "100%" }}>
            <Link
              prefetch={false}
              href={`/client/tournaments/${tournamentId}/bracket/create${bracketZoneQuery}`}
              style={{
                width: "100%",
                minHeight: "52px",
                borderRadius: "8px",
                border: "1px solid #047857",
                background: "#059669",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "none",
              }}
            >
              전체 대진표 만들기
            </Link>
            <Link
              prefetch={false}
              href={`/client/tournaments/${tournamentId}/bracket/auto${bracketZoneQuery}`}
              style={{
                width: "100%",
                minHeight: "48px",
                borderRadius: "8px",
                border: "1px solid #64748b",
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "none",
              }}
            >
              자동 배정으로 만들기
            </Link>
            <Link
              prefetch={false}
              href={`/client/tournaments/${tournamentId}/bracket/manual${bracketZoneQuery}`}
              style={{
                width: "100%",
                minHeight: "48px",
                borderRadius: "8px",
                border: "1px solid #64748b",
                background: "#fff",
                color: "#334155",
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "none",
              }}
            >
              수동 배정으로 만들기
            </Link>
          </div>
        ) : (
          <div className="v3-stack" style={{ gap: "0.65rem", width: "100%" }}>
            {bracket.bracketMode !== "multi_block" && displayRoundsSorted.length > 0 ? (
              <button
                type="button"
                disabled={actionLoading || interactionLocked || multiBlockBusy || bracketHasRecordedWinners}
                onClick={() => void executeRoundShuffle(displayRoundsSorted[0]!.roundNumber)}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  borderRadius: "8px",
                  border: "1px solid #d97706",
                  background: "#fffbeb",
                  color: "#9a3412",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  boxShadow: "none",
                  cursor:
                    actionLoading || interactionLocked || multiBlockBusy || bracketHasRecordedWinners
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {multiBlockBusy ? "처리 중…" : "대진표 생성/재생성"}
              </button>
            ) : bracket.bracketMode === "multi_block" ? (
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
                조 분할 상태에서는 「대진표 생성/재생성」으로 1라운드를 재배치할 수 없습니다. 전체 초기화 후 단일 대진표로 되돌린 뒤 이용하세요.
              </p>
            ) : null}

            {bracket.bracketMode !== "multi_block" && bracketHasRecordedWinners ? (
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
                승패가 기록된 뒤에는 「대진표 생성/재생성」과 「분할 실행」을 사용할 수 없습니다.
              </p>
            ) : null}

            <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
              <strong style={{ color: "#0f172a" }}>생성 시각:</strong>{" "}
              {new Date(bracket.createdAt).toLocaleString("ko-KR")}
            </p>

            {canSplitBracket(bracket) ? (
              <div
                className="v3-stack"
                style={{
                  gap: "0.5rem",
                  paddingTop: "0.55rem",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>조 분할</span>
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
                  조분할을 하시면 대진표를 운영하기가 편리합니다.
                  <br />
                  예) 64강을 16명씩 분할하여 4개 조로 운영 시 각 대진표 1위자가 결선 대진표에서 4강전으로 가능합니다.
                </p>
                <div
                  className="v3-row"
                  style={{
                    alignItems: "center",
                    gap: "0.45rem",
                    flexWrap: "nowrap",
                    width: "100%",
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", flexShrink: 0 }}>
                    조당 인원
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="v3-btn"
                    style={{
                      width: "3.75rem",
                      minWidth: "3rem",
                      maxWidth: "5rem",
                      minHeight: 34,
                      flex: "0 0 auto",
                      boxShadow: "none",
                      textAlign: "center",
                    }}
                    value={multiBlockSizeDraft}
                    onChange={(e) => setMultiBlockSizeDraft(e.target.value)}
                    disabled={interactionLocked}
                    aria-label="조당 인원"
                  />
                  <button
                    type="button"
                    className="v3-btn"
                    disabled={actionLoading || interactionLocked || multiBlockBusy || bracketHasRecordedWinners}
                    onClick={() => {
                      const blockSize = parseMultiBlockSplitSizeDraft(multiBlockSizeDraft);
                      if (blockSize === null) {
                        setMessage("조당 인원을 입력해 주세요.");
                        return;
                      }
                      if (blockSize < 2) {
                        setMessage("조당 인원은 2 이상으로 입력해 주세요.");
                        return;
                      }
                      if (projectedQualifierBlockCount(bracket, blockSize) < 4) {
                        setMessage("분할 후 결선이 최소 준결승(4강) 이상이 되려면 조가 4개 이상이어야 합니다.");
                        return;
                      }
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
                              body: JSON.stringify({ blockSize }),
                            },
                          );
                          const json = (await res.json()) as { bracket?: Bracket; error?: string };
                          if (!res.ok || !json.bracket) {
                            setMessage(json.error ?? "대진표 분할에 실패했습니다.");
                            return;
                          }
                          setBracket(json.bracket);
                          const groups = projectedQualifierBlockCount(bracket, blockSize);
                          setMessage(
                            `${blockSize}명 조당 · ${groups}개의 예선 대진표가 생성되었습니다. 대회개시(진행중)와 운영 메뉴는 대회 관리 홈에서 이용하세요.`,
                          );
                        } finally {
                          setMultiBlockBusy(false);
                        }
                      })();
                    }}
                    style={{
                      boxShadow: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      minHeight: 34,
                    }}
                  >
                    분할 실행
                  </button>
                </div>
                {splitParsedBlockSize != null && projectedQualifierBlockCount(bracket, splitParsedBlockSize) < 4 ? (
                  <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                    분할 후 결선이 최소 준결승(4강) 이상이 되려면 조가 4개 이상이어야 합니다.
                  </span>
                ) : null}
                {splitPreviewLine ? (
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>{splitPreviewLine}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        </BracketHubAccordionPanel>
      </div>

      <div
        id="confirmed-bracket"
        ref={confirmedSectionRef}
        className="v3-stack"
        style={{
          gap: "0.35rem",
          padding: "0.85rem 1rem",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
          background: "#fff",
          boxShadow: "none",
        }}
      >
        <BracketHubAccordionPanel
          sectionId="hub-ops"
          title="2. 대진표 운영"
          summary={hubOperatePhase ? "결과·라운드·보기" : "확정 후 운영 시작 전"}
          expanded={isAccordionOpen("ops")}
          onToggle={() => toggleAccordion("ops")}
        >
        {zonesEnabled && !selectedZoneId ? (
          <p className="v3-muted">권역을 선택해야 대진표를 볼 수 있습니다.</p>
        ) : !bracket ? (
          <p className="v3-muted">아직 확정된 대진표가 없습니다. 「1. 대진표 자동생성」에서 먼저 만들어 주세요.</p>
        ) : (
          <>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              빠른 입력·다음 라운드 생성·전체 화면 보기입니다.
            </p>
            <BracketProgressSummaryCard bracket={bracket} />
            {bracket.bracketMode === "multi_block" && bracket.blocks?.length ? (
              <div
                className="v3-row"
                style={{ gap: "0.35rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.35rem" }}
              >
                {bracket.blocks.map((bl) => {
                  const active = boardSliceKey === `block:${bl.id}`;
                  return (
                    <button
                      key={bl.id}
                      type="button"
                      onClick={() => setBoardSliceKey(`block:${bl.id}`)}
                      style={{
                        minHeight: 40,
                        padding: "0.35rem 0.65rem",
                        borderRadius: 8,
                        border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                        background: active ? "#2563eb" : "#fff",
                        color: active ? "#fff" : "#0f172a",
                        fontWeight: 700,
                        boxShadow: "none",
                      }}
                    >
                      조 {bl.label ?? bl.id}
                    </button>
                  );
                })}
                {bracket.finalBlock?.rounds?.length ? (
                  <button
                    type="button"
                    onClick={() => setBoardSliceKey("final")}
                    style={{
                      minHeight: 40,
                      padding: "0.35rem 0.65rem",
                      borderRadius: 8,
                      border: boardSliceKey === "final" ? "1px solid #1d4ed8" : "1px solid #cbd5e1",
                      background: boardSliceKey === "final" ? "#2563eb" : "#fff",
                      color: boardSliceKey === "final" ? "#fff" : "#0f172a",
                      fontWeight: 700,
                      boxShadow: "none",
                    }}
                  >
                    결선
                  </button>
                ) : null}
              </div>
            ) : null}

            {displayRoundsSorted.length > 0 ? (
              <div className="v3-stack" style={{ gap: "0.35rem" }}>
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  선택한 라운드가 모두 끝나면 다음 라운드를 생성합니다. (현재 조·결선 탭 기준)
                </p>
                <div className="v3-row" style={{ gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                  {displayRoundsSorted.map((round) => (
                    <button
                      key={`hub-adv-tab-${bracket.id}-${boardSliceKey ?? "root"}-${round.roundNumber}`}
                      type="button"
                      className={selectedQuickRoundNumber === round.roundNumber ? "ui-btn-primary-solid" : "v3-btn"}
                      onClick={() => setSelectedQuickRoundNumber(round.roundNumber)}
                      style={{ boxShadow: "none", minHeight: 36 }}
                    >
                      {roundLabelFromMatchCount(round.matches.length)}
                    </button>
                  ))}
                </div>
                {hubAdvanceTargetRound ? (
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={() => void handleAdvanceRound(hubAdvanceTargetRound.roundNumber)}
                    disabled={actionLoading || interactionLocked}
                    style={{
                      boxShadow: "none",
                      fontWeight: 700,
                      alignSelf: "flex-start",
                      minHeight: 44,
                      borderRadius: "8px",
                    }}
                  >
                    다음 라운드 생성
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="v3-stack" style={{ gap: "0.5rem", width: "100%" }}>
              <Link
                prefetch={false}
                href={`/client/tournaments/${tournamentId}/bracket/quick-results${bracketZoneQuery}`}
                style={{
                  width: "100%",
                  minHeight: "52px",
                  borderRadius: "8px",
                  border: "1px solid #0f766e",
                  background: "#14b8a6",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1rem",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "none",
                }}
              >
                빠른 결과 입력
              </Link>
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                라운드별 승패는 위 화면에서 빠르게 입력합니다.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket/view${bracketZoneQuery}`)}
                style={{
                  width: "100%",
                  minHeight: "52px",
                  borderRadius: "8px",
                  border: "1px solid #1d4ed8",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "1rem",
                  boxShadow: "none",
                }}
              >
                대진표 보기 (전체 화면)
              </button>
            </div>

            <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              운영판 UI는 전체 화면 「대진표 보기」에서 제공합니다.
            </p>
            {bracket.zoneId ? (
              <p style={{ margin: 0 }}>
                <strong>권역:</strong> {bracket.zoneId}
              </p>
            ) : null}
          </>
        )}
        </BracketHubAccordionPanel>
      </div>

      {connectivityHint || saveStateText || message ? (
        <p className="v3-muted">
          {connectivityHint}
          {connectivityHint && (saveStateText || message) ? " · " : ""}
          {saveStateText}
          {saveStateText && message ? " · " : ""}
          {message}
        </p>
      ) : null}

      <div
        aria-label="현장 운영"
        className="v3-stack"
        style={{
          gap: "0.35rem",
          padding: "0.85rem 1rem",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
          boxShadow: "none",
        }}
      >
        <BracketHubAccordionPanel
          sectionId="hub-field"
          title="3. 현장 운영"
          summary="TV·인쇄용 대진표"
          expanded={isAccordionOpen("field")}
          onToggle={() => toggleAccordion("field")}
        >
        <div className="v3-stack" style={{ gap: "0.5rem", width: "100%" }}>
          <button
            type="button"
            onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket/view${bracketZoneQuery}`)}
            style={{
              width: "100%",
              minHeight: "52px",
              borderRadius: "8px",
              border: "1px solid #1d4ed8",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: "1rem",
              boxShadow: "none",
              cursor: "pointer",
            }}
          >
            대진표 보기
          </button>
          {bracket?.bracketMode === "multi_block" ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/client/tournaments/${tournamentId}/bracket/view${
                    bracketZoneQuery ? `${bracketZoneQuery}&viewMode=merged` : "?viewMode=merged"
                  }`,
                )
              }
              style={{
                width: "100%",
                minHeight: "52px",
                borderRadius: "8px",
                border: "1px solid #0f766e",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1rem",
                boxShadow: "none",
                cursor: "pointer",
              }}
            >
              통합 대진표 보기
            </button>
          ) : null}
          {bracket?.bracketMode === "multi_block" ? (
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
              조별 대진표와 결선 대진표를 한 화면에서 함께 확인합니다.
            </p>
          ) : null}
        </div>

        <section
          className="v3-box v3-stack"
          aria-label="인쇄용 대진표"
          style={{ boxShadow: "none", border: "1px solid #e2e8f0", background: "#fff", padding: "0.65rem 0.75rem" }}
        >
          <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <h2 className="v3-h2" style={{ margin: 0 }}>인쇄용 대진표</h2>
            <button
              type="button"
              className="v3-btn"
              onClick={() => setPrintToolsOpen((prev) => !prev)}
              style={{ boxShadow: "none" }}
            >
              {printToolsOpen ? "닫기" : "열기"}
            </button>
          </div>
          {printToolsOpen ? (
            <TournamentGroupRound1PrintClient tournamentId={tournamentId} printStartPlayersHint={printStartPlayersHint} />
          ) : (
            <p className="v3-muted" style={{ margin: 0 }}>
              운영판과 분리된 인쇄 전용 화면입니다. 필요할 때 열어 사용하세요.
            </p>
          )}
        </section>

        <div>
          <p style={{ margin: "0 0 0.45rem", fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>TV 연결</p>
          <div className="client-tournament-manage" style={{ width: "100%", maxWidth: "100%" }}>
            <TournamentTvLinkBlock tournamentId={tournamentId} />
          </div>
        </div>
        </BracketHubAccordionPanel>
      </div>

      {bracket?.bracketMode === "multi_block" ? (
        <div
          className="v3-stack"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            background: "#fffbeb",
            boxShadow: "none",
          }}
        >
          <BracketHubAccordionPanel
            sectionId="hub-danger"
            title="4. 위험 작업"
            summary="조·전체 초기화 · 되돌리기 어려움"
            expanded={isAccordionOpen("danger")}
            onToggle={() => toggleAccordion("danger")}
            headerTone="danger"
          >
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", color: "#7f1d1d" }}>
            초기화는 참가자 순서를 바꾸지 않습니다. 참가자를 무작위로 다시 배치하려면 「대진표 생성/재생성」을 사용합니다.
          </p>
          <div className="v3-stack" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              disabled={!selectedQualifierBlockId || dangerBusy || (zonesEnabled && !selectedZoneId)}
              onClick={() => setZoneResetModalOpen(true)}
              style={{
                minHeight: "44px",
                padding: "0.5rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #b91c1c",
                background: "#fef2f2",
                color: "#991b1b",
                fontWeight: 600,
                cursor: !selectedQualifierBlockId ? "not-allowed" : "pointer",
                opacity: !selectedQualifierBlockId ? 0.55 : 1,
              }}
            >
              현재 조 결과 초기화
            </button>
            {!selectedQualifierBlockId ? (
              <span className="v3-muted" style={{ fontSize: "0.78rem" }}>
                예선 조(A/B/…)를 선택한 뒤 사용할 수 있습니다. 결선 화면에서는 이 초기화를 쓸 수 없습니다.
              </span>
            ) : null}
            <button
              type="button"
              disabled={dangerBusy || (zonesEnabled && !selectedZoneId)}
              onClick={() => {
                setFullResetWarnOpen(true);
              }}
              style={{
                minHeight: "44px",
                padding: "0.5rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #7f1d1d",
                background: "#991b1b",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              전체 초기화
            </button>
          </div>
          </BracketHubAccordionPanel>
        </div>
      ) : null}

      {zoneResetModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          onClick={() => (!dangerBusy ? setZoneResetModalOpen(false) : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zone-reset-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "22rem",
              background: "#fff",
              borderRadius: "12px",
              padding: "1.15rem",
              border: "1px solid #cbd5e1",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <h2 id="zone-reset-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              현재 조 결과 초기화
            </h2>
            <ul style={{ margin: "0 0 0.85rem", paddingLeft: "1.15rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              <li>선택한 예선 조의 경기 결과·승패·진출 상태가 삭제됩니다.</li>
              <li>참가자 위치·대진 구조는 유지됩니다.</li>
              <li>되돌릴 수 없습니다.</li>
            </ul>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" disabled={dangerBusy} onClick={() => setZoneResetModalOpen(false)} style={{ minHeight: 44 }}>
                취소
              </button>
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => void submitQualifierBlockReset()}
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {dangerBusy ? "처리 중…" : "초기화 진행"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fullResetWarnOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          onClick={() => (!dangerBusy ? setFullResetWarnOpen(false) : null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-reset-warn-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "22rem",
              background: "#fff",
              borderRadius: "12px",
              padding: "1.15rem",
              border: "1px solid #cbd5e1",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <h2 id="full-reset-warn-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              전체 초기화 (1단계)
            </h2>
            <ul style={{ margin: "0 0 0.85rem", paddingLeft: "1.15rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              <li>조분할(A/B/C…)이 해제됩니다.</li>
              <li>조별 결과·진출자·결선이 제거됩니다.</li>
              <li>조분할 전 단일 예선 1라운드 상태로 돌아갑니다.</li>
              <li>참가자 배치·경기 상대는 유지됩니다(다시 섞기 아님).</li>
              <li>되돌릴 수 없습니다.</li>
            </ul>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="v3-btn" disabled={dangerBusy} onClick={() => setFullResetWarnOpen(false)} style={{ minHeight: 44 }}>
                취소
              </button>
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => {
                  setFullResetWarnOpen(false);
                  setFullResetPasswordOpen(true);
                  setFullResetPasswordInput("");
                  setFullResetPasswordError("");
                }}
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#991b1b",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                계속 진행
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fullResetPasswordOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 401,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          onClick={() => {
            if (dangerBusy) return;
            setFullResetPasswordOpen(false);
            setFullResetPasswordInput("");
            setFullResetPasswordError("");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="full-reset-pw-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "22rem",
              background: "#fff",
              borderRadius: "12px",
              padding: "1.15rem",
              border: "1px solid #cbd5e1",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <h2 id="full-reset-pw-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              전체 초기화 (2단계)
            </h2>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem", color: "#475569" }}>
              로그인에 사용 중인 관리자 비밀번호를 입력해 주세요.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              value={fullResetPasswordInput}
              onChange={(e) => {
                setFullResetPasswordInput(e.target.value);
                setFullResetPasswordError("");
              }}
              disabled={dangerBusy}
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: "44px",
                padding: "0.5rem 0.65rem",
                fontSize: "1rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                marginBottom: "0.35rem",
              }}
            />
            {fullResetPasswordError ? (
              <p style={{ margin: "0 0 0.65rem", fontSize: "0.85rem", color: "#b91c1c" }}>{fullResetPasswordError}</p>
            ) : (
              <div style={{ marginBottom: "0.65rem" }} />
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                disabled={dangerBusy}
                onClick={() => {
                  setFullResetPasswordOpen(false);
                  setFullResetPasswordInput("");
                  setFullResetPasswordError("");
                }}
                style={{ minHeight: 44 }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={dangerBusy}
                onClick={() => void submitFullRevertAfterPassword()}
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#991b1b",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {dangerBusy ? "처리 중…" : "비밀번호 확인 후 초기화"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
