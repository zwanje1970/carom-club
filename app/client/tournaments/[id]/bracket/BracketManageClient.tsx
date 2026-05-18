"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactElement, type ReactNode, type SetStateAction } from "react";

import {
  findBracketMatchLocation as findBracketMatchLocationForSync,
  getSliceRoundsFromBracket as getSliceRoundsForWinnerSync,
  hasDownstreamRoundsInSlice as hasDownstreamRoundsInSliceForWinnerSync,
  isEligibleBracketWinnerUserId,
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
  applyLocalClearWinnerCascadeInSlice,
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
import { fetchClientBracketMetaJson } from "./bracket-client-poll-meta";
import { getShuffleRoundBlockedReason } from "../../../../../lib/bracket-shuffle-guards";
import { bracketSlotDisplayName } from "../../../../../lib/bracket-player-slot";

const TournamentGroupRound1PrintClient = dynamic(
  () => import("./TournamentGroupRound1PrintClient"),
  { ssr: false, loading: () => <p className="v3-muted">조별 1차 대진표 인쇄 도구를 불러오는 중…</p> },
);

const QuickResultDetailModal = dynamic(() => import("./QuickResultDetailModal"), {
  ssr: false,
  loading: () => null,
});

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
    quickResultDetail?: {
      firstAttackUserId: string;
      scorePlayer1: number;
      scorePlayer2: number;
      endInning: number;
      inningsPlayer1: number;
      inningsPlayer2: number;
      avgPlayer1: number;
      avgPlayer2: number;
      highRunPlayer1: number | null;
      highRunPlayer2: number | null;
      recordedAt: string;
    } | null;
  }>;
};

type Bracket = {
  id: string;
  tournamentId: string;
  snapshotId: string;
  zoneId?: string | null;
  rounds: BracketRoundDoc[];
  createdAt: string;
  updatedAt?: string;
  bracketMode?: "single" | "multi_block";
  blocks?: Array<{ id: string; label?: string; rounds: BracketRoundDoc[] }>;
  finalBlock?: { rounds: BracketRoundDoc[] };
  blockSplit?: { mode: "blockSize"; blockSize: number } | { mode: "blockCount"; blockCount: number };
  preSplitRootRounds?: BracketRoundDoc[];
};

/** 서버 문서와 동기: bracketMode 누락·캐시 불일치 시에도 조분할 구조면 true */
function bracketLooksLikeSplitLayout(b: Bracket | null): boolean {
  if (!b) return false;
  if (b.bracketMode === "multi_block") return true;
  if (Array.isArray(b.blocks) && b.blocks.length > 0) return true;
  if (b.finalBlock != null) return true;
  if (b.blockSplit != null) return true;
  return false;
}

function getSliceRoundsFromBracket(b: Bracket, sliceKey: string | null): BracketRoundDoc[] {
  if (bracketLooksLikeSplitLayout(b) && sliceKey) {
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
  if (bracketLooksLikeSplitLayout(bracket) && bracket.blocks?.length) {
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
  if (bracketLooksLikeSplitLayout(b) && b.finalBlock?.rounds?.length) {
    return b.finalBlock.rounds[b.finalBlock.rounds.length - 1] ?? null;
  }
  return b.rounds[b.rounds.length - 1] ?? null;
}

/** 단일(root) 확정 대진표만 분할 가능 */
function canSplitBracket(b: Bracket | null): boolean {
  if (!b || bracketLooksLikeSplitLayout(b)) return false;
  return b.rounds.some((r) => r.roundNumber === 1 && r.matches.length > 0);
}

/** 분할취소: 예선 각 조·결선에 라운드 1만 있을 때(진출 라운드 생성 전) */
function multiBlockSlicesOnlyRoundOne(b: Bracket | null): boolean {
  if (!b || !bracketLooksLikeSplitLayout(b) || !b.blocks?.length) return false;
  for (const bl of b.blocks) {
    if (bl.rounds.some((r) => r.roundNumber > 1)) return false;
  }
  if (b.finalBlock?.rounds?.some((r) => r.roundNumber > 1)) return false;
  return true;
}

function multiBlockSplitSizeFieldValue(b: Bracket | null, draft: string): string {
  if (!b || !bracketLooksLikeSplitLayout(b) || !b.blockSplit) return draft;
  if (b.blockSplit.mode === "blockSize") return String(b.blockSplit.blockSize);
  if (b.blockSplit.mode === "blockCount") return String(b.blockSplit.blockCount);
  return draft;
}

function collectBracketRoundDocs(b: Bracket): BracketRoundDoc[] {
  if (bracketLooksLikeSplitLayout(b)) {
    const out: BracketRoundDoc[] = [];
    for (const bl of b.blocks ?? []) {
      out.push(...bl.rounds);
    }
    if (b.finalBlock?.rounds?.length) out.push(...b.finalBlock.rounds);
    if (out.length > 0) return out;
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

/** `/client` 셸: `window`가 아니라 메인 스크롤 열(`.app-client-mobile-main-scroll`)이 스크롤된다. */
function findBracketHubScrollContainer(start: HTMLElement | null): HTMLElement | null {
  if (start == null || typeof window === "undefined") return null;
  let el: HTMLElement | null = start;
  while (el) {
    if (el.classList.contains("app-client-mobile-main-scroll")) return el;
    el = el.parentElement;
  }
  el = start;
  while (el && el !== document.documentElement) {
    const st = window.getComputedStyle(el);
    const oy = st.overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  const doc = document.scrollingElement;
  return doc instanceof HTMLElement ? doc : null;
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const prevExpandedRef = useRef(expanded);

  useLayoutEffect(() => {
    const wasExpanded = prevExpandedRef.current;
    prevExpandedRef.current = expanded;
    if (!expanded) return;
    if (wasExpanded) return;

    const run = () => {
      const el = sectionRef.current;
      if (!el) return;
      const scrollRoot = findBracketHubScrollContainer(el);
      if (!scrollRoot) return;
      const pad = 10;
      const rect = el.getBoundingClientRect();
      const rootRect = scrollRoot.getBoundingClientRect();
      const bottomLimit = rootRect.bottom - pad;
      if (rect.bottom <= bottomLimit) return;
      const delta = rect.bottom - bottomLimit;
      scrollRoot.scrollBy({ top: delta, behavior: "smooth" });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, [expanded]);

  return (
    <section ref={sectionRef} className="v3-stack" style={{ gap: "0.35rem" }} aria-labelledby={`${sectionId}-heading`}>
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

  if (bracketLooksLikeSplitLayout(b) && (sliceKey?.startsWith("block:") || sliceKey === "final")) {
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
  if (!bracketLooksLikeSplitLayout(b)) return "qualifiers_only";
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

function quickDetailInputStorageKey(tournamentId: string): string {
  return `v3:bracket:quick-detail-input:${tournamentId}`;
}

function readQuickDetailInputEnabled(tournamentId: string): boolean {
  if (!tournamentId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(quickDetailInputStorageKey(tournamentId)) === "1";
  } catch {
    return false;
  }
}

function writeQuickDetailInputEnabled(tournamentId: string, enabled: boolean): void {
  if (!tournamentId || typeof window === "undefined") return;
  try {
    const key = quickDetailInputStorageKey(tournamentId);
    if (enabled) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function defaultBoardSliceKey(b: Bracket | null): string | null {
  if (!b || !bracketLooksLikeSplitLayout(b) || !b.blocks?.[0]) return null;
  return `block:${b.blocks[0].id}`;
}

/** 대진표 보기·운영과 동일한 slice 저장 키 (`view/page.tsx`와 공유). */
function bracketManageSliceStorageKey(tournamentId: string, zoneSeg: string, bracketId: string): string {
  return `v3:bracketViewSlice:${tournamentId}:${zoneSeg}:${bracketId}`;
}

function readManageBracketSliceFromStorage(
  storageKey: string | null,
  bracket: Bracket & { bracketMode: "multi_block"; blocks: NonNullable<Bracket["blocks"]> },
): string | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw === "merged") return null;
    if (raw === "final" && bracket.finalBlock?.rounds?.length) return "final";
    if (raw?.startsWith("block:")) {
      const bid = raw.slice("block:".length);
      if (bracket.blocks.some((b) => b.id === bid)) return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeManageBracketSliceToStorage(storageKey: string | null, slice: string | null): void {
  if (!storageKey || typeof window === "undefined" || !slice || slice === "merged") return;
  try {
    sessionStorage.setItem(storageKey, slice);
  } catch {
    /* ignore */
  }
}

function clearManageBracketSliceStorage(storageKey: string | null): void {
  if (!storageKey || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function multiBlockBlockButtonLabel(bl: { id: string; label?: string }): string {
  const lab = typeof bl.label === "string" ? bl.label.trim() : "";
  if (lab !== "") return `${lab}조`;
  return `조 ${bl.id}`;
}

function bracketSlotLabel(p: { userId: string; name: string; displayName?: string | null }): string {
  return bracketSlotDisplayName(p);
}

function bracketRoundHasRecordedResult(r: BracketRoundDoc): boolean {
  for (const m of r.matches) {
    if (m.status === "COMPLETED") return true;
    const w = typeof m.winnerUserId === "string" ? m.winnerUserId.trim() : "";
    if (w !== "" && !w.startsWith("__")) return true;
  }
  return false;
}

function quickBracketRoundShuffleBlockedReason(sliceRounds: BracketRoundDoc[], round: BracketRoundDoc): string | null {
  if (bracketRoundHasRecordedResult(round)) return "이미 결과가 입력된 라운드는 재섞기할 수 없습니다.";
  return getShuffleRoundBlockedReason(sliceRounds, round.roundNumber);
}

/** 빠른 결과: 다음 라운드 카드는 이전 라운드에서 내려온 실참가자가 1명 이상 있을 때만 표시(빈 슬롯만이면 숨김). */
function quickResultsRoundHasAnyEligibleParticipant(round: BracketRoundDoc): boolean {
  for (const m of round.matches) {
    if (isEligibleBracketWinnerUserId(m.player1.userId)) return true;
    if (isEligibleBracketWinnerUserId(m.player2.userId)) return true;
  }
  return false;
}

/** 빠른 결과: 카드 제목 (참가 규모·조·라운드 기준, 고정 라운드 수 없음) */
function quickResultsRoundCardTitle(bracket: Bracket, boardSliceKey: string | null, round: BracketRoundDoc): string {
  const matches = round.matches?.length ?? 0;
  const size = Math.max(2, matches * 2);
  const idx = String(round.roundNumber).padStart(2, "0");
  if (boardSliceKey === "final") {
    if (matches === 1) return "결승";
    if (matches === 2 && size <= 4) return "준결승";
    return `결선 ${size}강`;
  }
  if (boardSliceKey?.startsWith("block:")) {
    const bid = boardSliceKey.slice("block:".length);
    const bl = bracket.blocks?.find((b) => b.id === bid);
    const lab = typeof bl?.label === "string" && bl.label.trim() !== "" ? bl.label.trim() : bid;
    return `${size}강-${lab}-${idx}경기`;
  }
  return `${size}강-A-${idx}경기`;
}

/** 조분할 입력값 문자열 → 숫자 (미입력·숫자 아님은 null). 실행 시점 검증용. */
function parseMultiBlockSplitSizeDraft(draft: string): number | null {
  const t = draft.trim();
  if (!t) return null;
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n)) return null;
  return n;
}

/** 서버 error 문자열 우선(비어 있으면 일반 실패 문구). 클라 전용 안내는 호출부에서 지정. */
function bracketHubFailureModalMessage(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (t) return t;
  return "요청을 처리하지 못했습니다.";
}

type BracketHubModalState =
  | null
  | { type: "error"; message: string }
  | { type: "splitCancelConfirm" }
  | { type: "splitCancelSuccess" }
  | {
      type: "shuffleRegenConfirm";
      roundNumber: number;
      scope: ReturnType<typeof shuffleScopeForSlice>;
      shuffleUi?: "hub" | "quickCard";
    }
  | { type: "shuffleRegenSuccess" }
  | { type: "participantsRequired" };

function BracketHubModalLayer({
  bracketHubModal,
  setBracketHubModal,
  multiBlockBusy,
  confirmShuffleRegenAndPost,
  confirmSplitCancelAndPost,
  loadLatestBracket,
  tournamentId,
  routerRefresh,
  routerPush,
}: {
  bracketHubModal: BracketHubModalState;
  setBracketHubModal: Dispatch<SetStateAction<BracketHubModalState>>;
  multiBlockBusy: boolean;
  confirmShuffleRegenAndPost: (
    roundNumber: number,
    scope: ReturnType<typeof shuffleScopeForSlice>,
  ) => Promise<void>;
  confirmSplitCancelAndPost: () => Promise<void>;
  loadLatestBracket: () => Promise<void>;
  tournamentId: string;
  routerRefresh: () => void;
  routerPush: (href: string) => void;
}): ReactElement | null {
  if (!bracketHubModal) return null;
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 402,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
        boxSizing: "border-box",
      }}
      onClick={() => {
        if (multiBlockBusy) return;
        if (bracketHubModal.type === "shuffleRegenConfirm" || bracketHubModal.type === "participantsRequired") {
          setBracketHubModal(null);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          bracketHubModal.type === "participantsRequired" ? "bracket-hub-participants-required-title" : undefined
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
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
        {bracketHubModal.type === "splitCancelConfirm" ? (
          <>
            <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>조 분할 취소</h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              분할을 취소하면 단일 대진표로 돌아갑니다. 대진 순서와 상대는 그대로 유지됩니다. 계속하시겠습니까?
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                disabled={multiBlockBusy}
                onClick={() => setBracketHubModal(null)}
                style={{ minHeight: 44 }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={multiBlockBusy}
                onClick={() => void confirmSplitCancelAndPost()}
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {multiBlockBusy ? "처리 중…" : "확인"}
              </button>
            </div>
          </>
        ) : null}
        {bracketHubModal.type === "shuffleRegenConfirm" ? (
          <>
            <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              {bracketHubModal.shuffleUi === "quickCard" ? "대진 재생성" : "대진표 생성/재생성"}
            </h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              {bracketHubModal.shuffleUi === "quickCard"
                ? "이 라운드에 배치된 참가자만 무작위로 다시 섞습니다. 다른 라운드·다른 조에는 영향이 없습니다. 계속하시겠습니까?"
                : "대진표가 재생성되면 기존 대진은 되돌릴 수 없습니다. 계속하시겠습니까?"}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                disabled={multiBlockBusy}
                onClick={() => setBracketHubModal(null)}
                style={{ minHeight: 44 }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={multiBlockBusy}
                onClick={() =>
                  void confirmShuffleRegenAndPost(bracketHubModal.roundNumber, bracketHubModal.scope)
                }
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#d97706",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {multiBlockBusy ? "처리 중…" : "확인"}
              </button>
            </div>
          </>
        ) : null}
        {bracketHubModal.type === "splitCancelSuccess" ? (
          <>
            <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>조 분할 취소</h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              분할이 취소되었습니다.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                }}
                onClick={() => {
                  setBracketHubModal(null);
                  void loadLatestBracket();
                  routerRefresh();
                }}
              >
                확인
              </button>
            </div>
          </>
        ) : null}
        {bracketHubModal.type === "shuffleRegenSuccess" ? (
          <>
            <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>대진표 생성/재생성</h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              대진표가 재생성되었습니다.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#d97706",
                  color: "#fff",
                  fontWeight: 700,
                }}
                onClick={() => {
                  setBracketHubModal(null);
                  void loadLatestBracket();
                  routerRefresh();
                }}
              >
                확인
              </button>
            </div>
          </>
        ) : null}
        {bracketHubModal.type === "participantsRequired" ? (
          <>
            <h2
              id="bracket-hub-participants-required-title"
              style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}
            >
              참가자 확정이 필요합니다
            </h2>
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.88rem", lineHeight: 1.5, color: "#334155" }}>
              대진표를 만들려면 먼저 참가자를 확정해야 합니다.
              <br />
              신청자 관리에서 참가자를 확정한 뒤 다시 진행하세요.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={() => setBracketHubModal(null)}
                style={{ minHeight: 44, fontWeight: 700 }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setBracketHubModal(null);
                  routerPush(`/client/tournaments/${tournamentId}/participants`);
                }}
                style={{
                  minHeight: 44,
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                신청자 관리로 이동
              </button>
            </div>
          </>
        ) : null}
        {bracketHubModal.type === "error" ? (
          <>
            <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>안내</h2>
            <p
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.88rem",
                lineHeight: 1.5,
                color: "#334155",
                whiteSpace: "pre-wrap",
              }}
            >
              {bracketHubModal.message}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="v3-btn"
                onClick={() => setBracketHubModal(null)}
                style={{ minHeight: 44, fontWeight: 700 }}
              >
                확인
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

type HubApplicationListItem = {
  status?: string;
  zoneId?: string | null;
};

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
  const [hubAutoSectionMessage, setHubAutoSectionMessage] = useState("");
  const [bracketHubModal, setBracketHubModal] = useState<BracketHubModalState>(null);
  const [tournamentStatusBadge, setTournamentStatusBadge] = useState("");
  const [applicationListItems, setApplicationListItems] = useState<HubApplicationListItem[]>([]);
  const [applicationListLoading, setApplicationListLoading] = useState(false);
  const [quickResultsRoundExpanded, setQuickResultsRoundExpanded] = useState<Record<number, boolean>>({});
  const confirmedSectionRef = useRef<HTMLDivElement | null>(null);
  const didInitialBoardFocusRef = useRef(false);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const manageSliceStorageKey = useMemo(() => {
    if (!tournamentId || !bracket?.id || !bracketLooksLikeSplitLayout(bracket)) return null;
    const z = zonesEnabled ? selectedZoneId : "-";
    return bracketManageSliceStorageKey(tournamentId, z, bracket.id);
  }, [tournamentId, bracket?.id, bracket?.bracketMode, bracket?.blocks, bracket?.finalBlock, bracket?.blockSplit, zonesEnabled, selectedZoneId]);

  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingActionKeysRef = useRef<Set<string>>(new Set());
  const bracketRef = useRef<Bracket | null>(null);
  const replayRunningRef = useRef(false);
  const quickResultsRemoteSigRef = useRef("");
  const sliceMetaRefManage = useRef<{ bracketId: string; blockSig: string }>({ bracketId: "", blockSig: "" });
  const prevManageSliceKeyParamRef = useRef("");
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [bracketSyncBusy, setBracketSyncBusy] = useState(false);
  const [quickResultsRefreshBusy, setQuickResultsRefreshBusy] = useState(false);
  const [quickDetailInputEnabled, setQuickDetailInputEnabled] = useState(false);
  const [quickDetailMatchId, setQuickDetailMatchId] = useState<string | null>(null);
  const storageSeg = useMemo(() => bracketOfflineSegment(zonesEnabled, selectedZoneId), [zonesEnabled, selectedZoneId]);

  useLayoutEffect(() => {
    bracketRef.current = bracket;
  }, [bracket]);

  useEffect(() => {
    if (!tournamentId) return;
    setQuickDetailInputEnabled(readQuickDetailInputEnabled(tournamentId));
  }, [tournamentId]);

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
      prevManageSliceKeyParamRef.current = "";
      return;
    }
    if (!bracketLooksLikeSplitLayout(bracket) || !bracket.blocks?.[0]) {
      setBoardSliceKey(null);
      sliceMetaRefManage.current = { bracketId: bracket.id, blockSig: "" };
      prevManageSliceKeyParamRef.current = "";
      return;
    }
    const urlSlice = searchParams.get("sliceKey")?.trim() ?? "";
    const sliceKeyParamChanged = prevManageSliceKeyParamRef.current !== urlSlice;
    prevManageSliceKeyParamRef.current = urlSlice;

    const blockSig = bracket.blocks.map((b) => b.id).join("|");
    const prevM = sliceMetaRefManage.current;
    const structuralChange = prevM.bracketId !== bracket.id || prevM.blockSig !== blockSig;
    sliceMetaRefManage.current = { bracketId: bracket.id, blockSig };
    const ids = new Set(bracket.blocks.map((b) => b.id));

    const resolveFromUrl = (): string | null => {
      if (urlSlice === "final" && bracket.finalBlock?.rounds?.length) return "final";
      if (urlSlice.startsWith("block:")) {
        const bid = urlSlice.slice("block:".length);
        if (ids.has(bid)) return urlSlice;
      }
      return null;
    };

    const fromUrl = resolveFromUrl();

    const readStoredSlice = (): string | null =>
      readManageBracketSliceFromStorage(
        manageSliceStorageKey,
        bracket as Bracket & { bracketMode: "multi_block"; blocks: NonNullable<Bracket["blocks"]> },
      );

    setBoardSliceKey((prevKey) => {
      if (fromUrl && (structuralChange || sliceKeyParamChanged)) {
        return fromUrl;
      }
      if (!structuralChange) {
        if (prevKey === "final" && bracket.finalBlock?.rounds?.length) return prevKey;
        if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
          const bid = prevKey.slice("block:".length);
          if (ids.has(bid)) return prevKey;
        }
        return prevKey;
      }
      const stored = readStoredSlice();
      if (stored) return stored;
      const hasFinal = Boolean(bracket.finalBlock?.rounds?.length);
      if (prevKey === "final" && hasFinal) return "final";
      if (typeof prevKey === "string" && prevKey.startsWith("block:")) {
        const bid = prevKey.slice("block:".length);
        if (ids.has(bid)) return prevKey;
      }
      return defaultBoardSliceKey(bracket);
    });
  }, [bracket, searchParams, manageSliceStorageKey]);

  useEffect(() => {
    if (!bracket || !bracketLooksLikeSplitLayout(bracket)) return;
    if (!manageSliceStorageKey || !boardSliceKey || boardSliceKey === "merged") return;
    writeManageBracketSliceToStorage(manageSliceStorageKey, boardSliceKey);
  }, [bracket, manageSliceStorageKey, boardSliceKey]);

  useEffect(() => {
    setHubAutoSectionMessage("");
  }, [bracket?.id, selectedZoneId]);

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

  const displayRoundsSorted = useMemo(
    () => [...displayRounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [displayRounds],
  );

  const quickResultsRoundCards = useMemo(() => {
    if (variant !== "quickResults") return [];
    const sorted = [...displayRounds].sort((a, b) => a.roundNumber - b.roundNumber);
    if (!sorted.length) return [];
    const minRn = sorted[0]!.roundNumber;
    const visible = sorted.filter(
      (r) => r.roundNumber === minRn || quickResultsRoundHasAnyEligibleParticipant(r),
    );
    if (!visible.length) return [];
    const firstIncompleteIdx = visible.findIndex((r) => r.status !== "COMPLETED");
    const inProgress = firstIncompleteIdx === -1 ? null : visible[firstIncompleteIdx]!;
    const nextCandidate =
      inProgress && firstIncompleteIdx + 1 < visible.length ? visible[firstIncompleteIdx + 1]! : null;
    const nextWaiting =
      nextCandidate && nextCandidate.matches.every((m) => m.status === "PENDING") ? nextCandidate : null;
    const topKeys = new Set<number>();
    const cards: Array<{ round: BracketRoundDoc; role: "inProgress" | "next" | "completed" }> = [];
    if (inProgress) {
      cards.push({ round: inProgress, role: "inProgress" });
      topKeys.add(inProgress.roundNumber);
    }
    if (nextWaiting && !topKeys.has(nextWaiting.roundNumber)) {
      cards.push({ round: nextWaiting, role: "next" });
      topKeys.add(nextWaiting.roundNumber);
    }
    for (const r of visible) {
      if (r.status === "COMPLETED" && !topKeys.has(r.roundNumber)) {
        cards.push({ round: r, role: "completed" });
        topKeys.add(r.roundNumber);
      }
    }
    for (const r of visible) {
      if (!topKeys.has(r.roundNumber)) {
        cards.push({ round: r, role: "inProgress" });
        topKeys.add(r.roundNumber);
      }
    }
    return cards;
  }, [variant, displayRounds]);

  useEffect(() => {
    if (variant !== "quickResults") return;
    setQuickResultsRoundExpanded({});
  }, [variant, bracket?.id, boardSliceKey]);

  const bracketHasRecordedWinners = useMemo(() => bracketHasAnyRecordedWinner(bracket), [bracket]);

  const multiBlockSplitCancelAllowed = useMemo(
    () =>
      !!bracket &&
      bracketLooksLikeSplitLayout(bracket) &&
      !bracketHasAnyRecordedWinner(bracket) &&
      multiBlockSlicesOnlyRoundOne(bracket),
    [bracket],
  );

  const bracketOpsSliceQuerySuffix = useMemo(() => {
    if (!bracket || !bracketLooksLikeSplitLayout(bracket) || !boardSliceKey || boardSliceKey === "merged") {
      return "";
    }
    const sep = bracketZoneQuery ? "&" : "?";
    return `${sep}sliceKey=${encodeURIComponent(boardSliceKey)}`;
  }, [bracket, bracketZoneQuery, boardSliceKey]);

  const bracketViewOpsPath = useMemo(
    () => `/client/tournaments/${tournamentId}/bracket/view${bracketZoneQuery}${bracketOpsSliceQuerySuffix}`,
    [bracketOpsSliceQuerySuffix, bracketZoneQuery, tournamentId],
  );

  /** 통합(A조+B조+결선) 보기 — `viewMode=merged` 유지 */
  const bracketViewMergedFullPath = useMemo(() => {
    const base = `/client/tournaments/${tournamentId}/bracket/view`;
    if (!bracket || !bracketLooksLikeSplitLayout(bracket)) return `${base}${bracketZoneQuery}`;
    return bracketZoneQuery ? `${base}${bracketZoneQuery}&viewMode=merged` : `${base}?viewMode=merged`;
  }, [bracket, bracketZoneQuery, tournamentId]);

  const quickResultsHref = useMemo(
    () => `/client/tournaments/${tournamentId}/bracket/quick-results${bracketZoneQuery}${bracketOpsSliceQuerySuffix}`,
    [bracketOpsSliceQuerySuffix, bracketZoneQuery, tournamentId],
  );

  const hubOperatePhase = useMemo(() => {
    if (!bracket) return false;
    if (bracketLooksLikeSplitLayout(bracket)) return true;
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

  const quickDetailModalMatch = useMemo(() => {
    if (!quickDetailMatchId) return null;
    for (const r of displayRoundsSorted) {
      const m = r.matches.find((x) => x.id === quickDetailMatchId);
      if (m) return m;
    }
    return null;
  }, [quickDetailMatchId, displayRoundsSorted]);

  const quickDetailModalLabels = useMemo(() => {
    if (!quickDetailModalMatch) return { p1: "", p2: "" };
    return {
      p1: bracketSlotLabel(quickDetailModalMatch.player1),
      p2: bracketSlotLabel(quickDetailModalMatch.player2),
    };
  }, [quickDetailModalMatch]);

  useEffect(() => {
    if (!quickDetailInputEnabled) setQuickDetailMatchId(null);
  }, [quickDetailInputEnabled]);

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
    setBracket(pulled.bracket);
    if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
    else writeLastGoodBracket(tournamentId, seg, null);
    setMessage("");
  }, [pullManageBracket, storageSeg, tournamentId, zonesEnabled, selectedZoneId]);

  useEffect(() => {
    if (variant !== "quickResults") return;
    if (!bracket) {
      quickResultsRemoteSigRef.current = "";
      return;
    }
    const u = typeof bracket.updatedAt === "string" && bracket.updatedAt.trim() !== "" ? bracket.updatedAt.trim() : "";
    quickResultsRemoteSigRef.current = u || bracket.createdAt || "";
  }, [variant, bracket]);

  const applyQuickResultsPolledBracket = useCallback(
    async (opts?: { skipMeta?: boolean }) => {
      if (variant !== "quickResults") return;
      if (!tournamentId) return;
      if (zonesEnabled && !selectedZoneId) return;
      const seg = storageSeg;
      if (readOfflineDirty(tournamentId, seg)) return;
      if (!opts?.skipMeta) {
        const meta = await fetchClientBracketMetaJson(tournamentId, zonesEnabled, selectedZoneId);
        if (!meta.updatedAt || meta.updatedAt === quickResultsRemoteSigRef.current) return;
      }
      const pulled = await pullManageBracket();
      if (!pulled.ok) return;
      if (readOfflineDirty(tournamentId, seg)) return;
      setBracket(pulled.bracket);
      if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
      else writeLastGoodBracket(tournamentId, seg, null);
    },
    [pullManageBracket, selectedZoneId, storageSeg, tournamentId, variant, zonesEnabled],
  );

  const onQuickResultsManualRefresh = useCallback(async () => {
    if (variant !== "quickResults") return;
    if (quickResultsRefreshBusy) return;
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) return;
    setQuickResultsRefreshBusy(true);
    try {
      const seg = storageSeg;
      if (readOfflineDirty(tournamentId, seg)) return;
      const pulled = await pullManageBracket();
      if (!pulled.ok) return;
      if (readOfflineDirty(tournamentId, seg)) return;
      setBracket(pulled.bracket);
      if (pulled.bracket) writeLastGoodBracket(tournamentId, seg, pulled.bracket);
      else writeLastGoodBracket(tournamentId, seg, null);
    } finally {
      setQuickResultsRefreshBusy(false);
    }
  }, [pullManageBracket, quickResultsRefreshBusy, selectedZoneId, storageSeg, tournamentId, variant, zonesEnabled]);

  useEffect(() => {
    if (variant !== "quickResults") return;
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) return;
    let cancelled = false;
    const POLL_MS = 10_000;

    const tick = async () => {
      if (cancelled || (typeof document !== "undefined" && document.hidden)) return;
      await applyQuickResultsPolledBracket();
    };

    const onVis = () => {
      if (!document.hidden) void applyQuickResultsPolledBracket({ skipMeta: true });
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    const timer = typeof window !== "undefined" ? window.setInterval(tick, POLL_MS) : 0;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [applyQuickResultsPolledBracket, selectedZoneId, tournamentId, variant, zonesEnabled]);

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
        setTournamentStatusBadge(
          typeof json.tournament.statusBadge === "string" ? json.tournament.statusBadge.trim() : "",
        );
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

  const loadApplicationListItems = useCallback(async () => {
    if (!tournamentId) return;
    setApplicationListLoading(true);
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/applications/list-items`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { ok?: boolean; entries?: HubApplicationListItem[]; error?: string };
      if (!res.ok || !json.ok || !Array.isArray(json.entries)) {
        setApplicationListItems([]);
        return;
      }
      setApplicationListItems(json.entries);
    } catch {
      setApplicationListItems([]);
    } finally {
      setApplicationListLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (variant !== "full" || !tournamentId || bracket) return;
    void loadApplicationListItems();
  }, [variant, tournamentId, bracket, loadApplicationListItems]);

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
        return { ok: false as const, error: result.error ?? "대진표를 갱신하지 못했습니다." };
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
          /** 동기화 시점의 서버 스냅샷으로 reset/PATCH 순서만 계산(UI는 pull 결과로 덮지 않음) */
          const pulled = await pullManageBracket();
          if (!pulled.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(pulled.error ?? "대진표를 불러 동기화하지 못했습니다.");
            return;
          }
          if (!pulled.bracket) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage("확정 대진표가 없습니다.");
            return;
          }
          const rs = await syncClearMatchWinner({
            bracket: pulled.bracket as BracketLike,
            matchId: op.matchId,
            mut: mutationFnsQuick,
            hasDownstream: hasDownstreamForSync,
          });
          if (!rs.ok) {
            writeOfflinePending(tournamentId, seg, ops.slice(i));
            setMessage(rs.error);
            return;
          }
          /** 로컬 정본 우선: 서버 응답 bracket으로 화면을 덮어쓰지 않음 */
          work =
            (bracketRef.current as BracketLike | null) ??
            applyLocalClearWinnerCascadeInSlice(work as BracketLike, op.matchId) ??
            (rs.bracket as BracketLike);
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

      setMessage("결승 결과가 확정되었습니다.");
      setSaveState("idle");
      return true;
    },
    [captureBracketImageSnapshot, selectedZoneId, tournamentId, zonesEnabled],
  );

  useEffect(() => {
    if (!bracket) return;
    if (!interactionLocked) return;
    if (snapshotImageUrl || snapshotCaptureFailed) return;
    void captureBracketImageSnapshot(bracket);
  }, [bracket, captureBracketImageSnapshot, interactionLocked, snapshotCaptureFailed, snapshotImageUrl]);

  /** 빠른결과: 승패 결과 취소 — 로컬 브래킷 정본 즉시 반영 후 clear_winner 큐로 서버 동기화(응답으로 로컬 덮어쓰지 않음). */
  const handleQuickClearMatchResult = useCallback(
    (
      matchId: string,
      rowCtx?: { roundNumber: number; boardSliceKey: string | null; rowIndex1Based?: number },
    ) => {
      const trimmedId = matchId.trim();
      if (!tournamentId || interactionLocked || !trimmedId) return;
      const seg = storageSeg;
      const snap = bracketRef.current as BracketLike | null;
      if (!snap) {
        console.warn("[quick-results clear-match-result] bracketRef null", { matchId: trimmedId, rowCtx });
        setSaveState("error");
        setMessage("대진표 데이터가 없습니다.");
        return;
      }
      const locPre = findBracketMatchLocationForSync(snap, trimmedId);
      if (!locPre) {
        console.warn("[quick-results clear-match-result] match not found (local)", {
          matchId: trimmedId,
          rowCtx,
          bracketId: snap.id,
        });
        setSaveState("error");
        setMessage("대상 매치를 찾을 수 없습니다.");
        return;
      }
      if (rowCtx) {
        if (locPre.round.roundNumber !== rowCtx.roundNumber) {
          console.warn("[quick-results clear-match-result] roundNumber mismatch (row vs local bracket)", {
            matchId: trimmedId,
            rowCtx,
            bracketRoundNumber: locPre.round.roundNumber,
          });
        }
        if ((locPre.sliceKey ?? null) !== (rowCtx.boardSliceKey ?? null)) {
          console.warn("[quick-results clear-match-result] sliceKey mismatch (tab vs local bracket)", {
            matchId: trimmedId,
            rowCtx,
            bracketSliceKey: locPre.sliceKey,
          });
        }
      }
      const next = applyLocalClearWinnerCascadeInSlice(snap, trimmedId);
      if (!next) {
        setSaveState("error");
        setMessage("승패 결과를 취소할 수 없습니다.");
        return;
      }
      bumpBracketLocalAuthorityRev(tournamentId, seg);
      setBracket(next as Bracket);
      writeLastGoodBracket(tournamentId, seg, next as Bracket);
      appendOfflinePending(tournamentId, seg, { type: "clear_winner", matchId: trimmedId });
      setOfflineDirty(tournamentId, seg, true);
      setSaveState("idle");
      setMessage("");
      queueMicrotask(() => {
        void replayOfflinePendingManage();
      });
    },
    [interactionLocked, replayOfflinePendingManage, storageSeg, tournamentId],
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

  const runShuffleRoundOneApi = useCallback(
    async (
      roundNumber: number,
      scope: ReturnType<typeof shuffleScopeForSlice>,
    ): Promise<{ ok: true; bracket: Bracket } | { ok: false; error?: string }> => {
      if (!tournamentId) return { ok: false, error: "" };
      const b = bracketRef.current;
      if (!b) return { ok: false, error: "" };
      if (bracketLooksLikeSplitLayout(b)) {
        const scoped =
          scope === "final_only" || (typeof scope === "object" && scope && "blockId" in scope && scope.blockId);
        if (!scoped) {
          return {
            ok: false,
            error:
              "조분할 상태에서는 예선 조 또는 결선을 선택한 뒤 해당 구간의 라운드만 재배치할 수 있습니다.",
          };
        }
      }
      try {
        const res = await fetch(
          `/api/client/tournaments/${tournamentId}/bracket/shuffle-round-one${bracketZoneQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ scope, roundNumber }),
          },
        );
        const json = (await res.json()) as { bracket?: Bracket; error?: string };
        if (!res.ok || !json.bracket) {
          return { ok: false, error: json.error };
        }
        return { ok: true, bracket: json.bracket };
      } catch {
        return { ok: false, error: "라운드 재배치 중 오류가 발생했습니다." };
      }
    },
    [bracketZoneQuery, tournamentId],
  );

  const confirmShuffleRegenAndPost = useCallback(
    async (roundNumber: number, scope: ReturnType<typeof shuffleScopeForSlice>) => {
      setBracketHubModal(null);
      setMultiBlockBusy(true);
      setHubAutoSectionMessage("");
      try {
        const r = await runShuffleRoundOneApi(roundNumber, scope);
        if (!r.ok) {
          setBracketHubModal({ type: "error", message: bracketHubFailureModalMessage(r.error) });
          return;
        }
        setBracket(r.bracket);
        writeLastGoodBracket(tournamentId, storageSeg, r.bracket);
        setBracketHubModal({ type: "shuffleRegenSuccess" });
      } finally {
        setMultiBlockBusy(false);
      }
    },
    [runShuffleRoundOneApi, storageSeg, tournamentId],
  );

  const openSplitCancelConfirmOrExplain = useCallback(() => {
    if (actionLoading || multiBlockBusy) {
      setBracketHubModal({ type: "error", message: "처리 중입니다. 잠시 후 다시 시도하세요." });
      return;
    }
    if (interactionLocked) {
      setBracketHubModal({ type: "error", message: "현재 대진표 작업을 진행할 수 없는 상태입니다." });
      return;
    }
    setBracketHubModal({ type: "splitCancelConfirm" });
  }, [actionLoading, interactionLocked, multiBlockBusy]);

  const confirmSplitCancelAndPost = useCallback(async () => {
    if (!tournamentId) {
      setBracketHubModal({ type: "error", message: "조분할을 취소하지 못했습니다." });
      return;
    }
    if (actionLoading || multiBlockBusy) {
      setBracketHubModal({ type: "error", message: "처리 중입니다. 잠시 후 다시 시도하세요." });
      return;
    }
    if (interactionLocked) {
      setBracketHubModal({ type: "error", message: "현재 대진표 작업을 진행할 수 없는 상태입니다." });
      return;
    }
    const z = zonesEnabled ? selectedZoneId : "-";
    const sliceClearBracketId = bracket?.id ?? null;
    const sliceClearKey =
      sliceClearBracketId && tournamentId
        ? bracketManageSliceStorageKey(tournamentId, z, sliceClearBracketId)
        : null;
    setBracketHubModal(null);
    setMultiBlockBusy(true);
    setHubAutoSectionMessage("");
    try {
      const res = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/bracket/cancel-multi-block-split${bracketZoneQuery}`,
        { method: "POST", credentials: "same-origin" },
      );
      const json = (await res.json()) as { bracket?: Bracket; error?: string };
      if (!res.ok || !json.bracket) {
        setBracketHubModal({
          type: "error",
          message: bracketHubFailureModalMessage(json.error),
        });
        return;
      }
      if (sliceClearKey) clearManageBracketSliceStorage(sliceClearKey);
      setBracket(json.bracket);
      writeLastGoodBracket(tournamentId, storageSeg, json.bracket);
      void loadLatestBracket();
      router.refresh();
      setBracketHubModal({ type: "splitCancelSuccess" });
    } finally {
      setMultiBlockBusy(false);
    }
  }, [
    actionLoading,
    bracket?.id,
    bracketZoneQuery,
    interactionLocked,
    loadLatestBracket,
    multiBlockBusy,
    router,
    selectedZoneId,
    storageSeg,
    tournamentId,
    zonesEnabled,
  ]);

  async function handleSwapPlayers(args: {
    roundNumber: number;
    first: { matchId: string; slot: "player1" | "player2" };
    second: { matchId: string; slot: "player1" | "player2" };
  }) {
    if (!bracket || actionLoading || interactionLocked) return;
    if (args.first.matchId === args.second.matchId && args.first.slot === args.second.slot) return;
    const loc = findBracketMatchLocation(bracket, args.first.matchId);
    const swapSlice = loc?.sliceKey ?? null;
    if (bracketLooksLikeSplitLayout(bracket) && swapSlice === null) {
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
    if (bracketLooksLikeSplitLayout(bracket) && renameSlice === null) {
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
    if (bracketLooksLikeSplitLayout(bracket)) {
      setSaveState("error");
      setMessage(
        "조분할 상태에서는 대진표 생성/재생성을 사용할 수 없습니다. 「분할취소」로 단일 예선으로 복귀한 뒤 이용해 주세요.",
      );
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
    if (players.some((p) => !isEligibleBracketWinnerUserId(p.userId.trim()))) {
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

  const approvedEntriesForHub = useMemo(() => {
    return applicationListItems.filter((e) => {
      if (e.status !== "APPROVED") return false;
      if (!zonesEnabled || !selectedZoneId) return true;
      const z = typeof e.zoneId === "string" ? e.zoneId.trim() : "";
      return z === selectedZoneId;
    });
  }, [applicationListItems, zonesEnabled, selectedZoneId]);

  const approvedCountForHub = approvedEntriesForHub.length;

  const bracketPlanEnabledForCreate = useMemo(() => {
    const b = tournamentStatusBadge.trim();
    return b === "마감" || b === "진행중" || b === "종료";
  }, [tournamentStatusBadge]);

  const participantsReadyForBracketCreation = useMemo(() => {
    if (variant !== "full") return true;
    if (!bracketPlanEnabledForCreate) return false;
    if (applicationListLoading) return false;
    if (approvedCountForHub < 2) return false;
    if (zonesEnabled && !selectedZoneId) return false;
    return true;
  }, [
    variant,
    bracketPlanEnabledForCreate,
    applicationListLoading,
    approvedCountForHub,
    zonesEnabled,
    selectedZoneId,
  ]);

  const tryOpenBracketCreation = useCallback(
    (relativePath: string) => {
      if (zonesEnabled && !selectedZoneId) return;
      if (!participantsReadyForBracketCreation) {
        setBracketHubModal({ type: "participantsRequired" });
        return;
      }
      router.push(relativePath);
    },
    [router, zonesEnabled, selectedZoneId, participantsReadyForBracketCreation],
  );

  if (variant === "quickResults") {
    let quickSplitShuffleReady = true;
    if (bracket && bracketLooksLikeSplitLayout(bracket)) {
      const s = shuffleScopeForSlice(bracket, boardSliceKey);
      quickSplitShuffleReady = s === "final_only" || typeof s === "object";
    }

    return (
      <>
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
          <div className="v3-row" style={{ alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="v3-btn"
              disabled={quickResultsRefreshBusy || !bracket}
              onClick={() => void onQuickResultsManualRefresh()}
              style={{
                padding: "0.4rem 0.55rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                minHeight: "40px",
                boxShadow: "none",
                opacity: quickResultsRefreshBusy ? 0.78 : 1,
              }}
            >
              {quickResultsRefreshBusy ? "새로고침…" : "새로고침"}
            </button>
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
              onClick={() => router.push(bracketViewOpsPath)}
            >
              대진표 보기
            </button>
          </div>
        </div>

        <div className="v3-row" style={{ alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontWeight: 700,
              fontSize: "0.86rem",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={quickDetailInputEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setQuickDetailInputEnabled(next);
                writeQuickDetailInputEnabled(tournamentId, next);
              }}
              style={{ width: "1rem", height: "1rem" }}
            />
            상세입력
          </label>
          <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "#94a3b8", lineHeight: 1.3 }}>
            VS 터치 시 기록 입력
          </span>
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
            {bracketLooksLikeSplitLayout(bracket) && bracket.blocks?.length ? (
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

            {quickResultsRoundCards.length === 0 ? (
              <p className="v3-muted">표시할 라운드가 없습니다.</p>
            ) : (
              quickResultsRoundCards.map(({ round, role }) => {
                const expanded = Boolean(quickResultsRoundExpanded[round.roundNumber]);
                const shuffleBlock = quickBracketRoundShuffleBlockedReason(displayRounds, round);
                const shuffleDisabled =
                  !quickSplitShuffleReady ||
                  Boolean(shuffleBlock) ||
                  actionLoading ||
                  interactionLocked ||
                  multiBlockBusy;
                const showBody = role !== "completed" || expanded;
                return (
              <section
                key={round.roundNumber}
                className="v3-box v3-stack"
                style={{
                  marginBottom: "0.45rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "0.5rem 0.55rem",
                  gap: "0.35rem",
                }}
              >
                <div
                  className="v3-row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.35rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div className="v3-stack" style={{ gap: "0.12rem", minWidth: 0 }}>
                    <div className="v3-row" style={{ alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>
                        {quickResultsRoundCardTitle(bracket, boardSliceKey, round)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: role === "inProgress" ? "#2563eb" : role === "next" ? "#ca8a04" : "#64748b",
                        }}
                      >
                        {role === "inProgress" ? "진행 중" : role === "next" ? "다음" : "완료"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {round.matches.length}경기 · {round.matches.length * 2}명 슬롯
                    </span>
                  </div>
                  <div className="v3-row" style={{ gap: "0.25rem", flexWrap: "wrap", alignItems: "center" }}>
                    {role === "completed" ? (
                      <button
                        type="button"
                        className="v3-btn"
                        style={{
                          minHeight: 32,
                          padding: "0.2rem 0.45rem",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          boxShadow: "none",
                        }}
                        onClick={() =>
                          setQuickResultsRoundExpanded((prev) => ({
                            ...prev,
                            [round.roundNumber]: !prev[round.roundNumber],
                          }))
                        }
                      >
                        {expanded ? "접기" : "펼치기"}
                      </button>
                    ) : null}
                    {round.matches.length > 1 ? (
                    <button
                      type="button"
                      className="v3-btn"
                      title={
                        !quickSplitShuffleReady
                          ? "예선 조 또는 결선을 선택한 뒤 사용하세요."
                          : shuffleBlock ?? undefined
                      }
                      disabled={shuffleDisabled}
                      style={{
                        minHeight: 32,
                        padding: "0.2rem 0.45rem",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        boxShadow: "none",
                      }}
                      onClick={() => {
                        if (!bracket) return;
                        setBracketHubModal({
                          type: "shuffleRegenConfirm",
                          roundNumber: round.roundNumber,
                          scope: shuffleScopeForSlice(bracket, boardSliceKey),
                          shuffleUi: "quickCard",
                        });
                      }}
                    >
                      대진 재생성
                    </button>
                    ) : null}
                  </div>
                </div>
                {showBody ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                    <tbody>
                      {round.matches.map((match) => {
                        const p1Label = bracketSlotLabel(match.player1);
                        const p2Label = bracketSlotLabel(match.player2);
                        const done =
                          match.status === "COMPLETED" &&
                          typeof match.winnerUserId === "string" &&
                          match.winnerUserId.trim() !== "";
                        const p1Win = done && match.winnerUserId === match.player1.userId;
                        const p2Win = done && match.winnerUserId === match.player2.userId;
                        const detailRecorded =
                          typeof match.quickResultDetail?.recordedAt === "string" &&
                          match.quickResultDetail.recordedAt.trim() !== "";
                        const vsMark = detailRecorded ? (
                          <>
                            vs
                            <span style={{ fontSize: "0.72em", color: "#16a34a", fontWeight: 800, marginLeft: "0.06em" }} title="상세기록 있음">
                              ✓
                            </span>
                          </>
                        ) : (
                          "vs"
                        );
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
                            <td
                              style={{
                                padding: "0.35rem 0.4rem",
                                maxWidth: 0,
                                width: "38%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 600,
                              }}
                              title={p1Label}
                            >
                              {p1Label}
                            </td>
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
                                          void handleSetWinner(match.id, match.player1.userId, round.roundNumber)
                                        }
                                        disabled={actionLoading || interactionLocked}
                                      >
                                        승
                                      </button>
                                    )}
                            </td>
                            <td
                              style={{
                                padding: "0.35rem 0.25rem",
                                color: "#64748b",
                                textAlign: "center",
                                verticalAlign: "middle",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {quickDetailInputEnabled ? (
                                <button
                                  type="button"
                                  onClick={() => setQuickDetailMatchId(match.id)}
                                  disabled={interactionLocked}
                                  title={detailRecorded ? "상세 기록" : "상세 입력"}
                                  style={{
                                    border: "1px solid rgba(148, 163, 184, 0.75)",
                                    background: "#fff",
                                    borderRadius: 6,
                                    padding: "0.1rem 0.42rem",
                                    fontSize: "0.82rem",
                                    color: "#64748b",
                                    fontWeight: 600,
                                    lineHeight: 1.25,
                                    minWidth: "2.75rem",
                                    cursor: interactionLocked ? "not-allowed" : "pointer",
                                    opacity: interactionLocked ? 0.55 : 1,
                                  }}
                                >
                                  {vsMark}
                                </button>
                              ) : (
                                <span style={{ pointerEvents: "none", userSelect: "none" }}>{vsMark}</span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "0.35rem 0.4rem",
                                maxWidth: 0,
                                width: "38%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 600,
                              }}
                              title={p2Label}
                            >
                              {p2Label}
                            </td>
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
                                          void handleSetWinner(match.id, match.player2.userId, round.roundNumber)
                                        }
                                        disabled={actionLoading || interactionLocked}
                                      >
                                        승
                                      </button>
                                    )}
                            </td>
                            <td style={{ padding: "0.2rem 0.15rem", whiteSpace: "nowrap", width: "1.75rem" }}>
                              <button
                                type="button"
                                className="v3-btn"
                                aria-label="이 경기 승패 결과 취소"
                                title="이 경기 승패 결과 취소"
                                disabled={!done || actionLoading || interactionLocked}
                                onClick={() =>
                                  void handleQuickClearMatchResult(match.id, {
                                    roundNumber: round.roundNumber,
                                    boardSliceKey,
                                  })
                                }
                                style={{
                                  minWidth: 28,
                                  minHeight: 28,
                                  width: 28,
                                  height: 28,
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.95rem",
                                  lineHeight: 1,
                                  borderRadius: "0.25rem",
                                  boxShadow: "none",
                                  border: "1px solid rgba(148, 163, 184, 0.45)",
                                  background: "#fff",
                                  color: "#64748b",
                                  fontWeight: 500,
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
                ) : null}
              </section>
                );
              })
            )}
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
        <QuickResultDetailModal
          open={Boolean(tournamentId && quickDetailMatchId && quickDetailModalMatch)}
          onClose={() => setQuickDetailMatchId(null)}
          match={quickDetailModalMatch}
          tournamentId={tournamentId}
          bracketZoneQuery={bracketZoneQuery}
          p1Label={quickDetailModalLabels.p1}
          p2Label={quickDetailModalLabels.p2}
          disabled={interactionLocked}
          onSaved={(b) => {
            setBracket(b as Bracket);
            writeLastGoodBracket(tournamentId, storageSeg, b as Bracket);
            bumpBracketLocalAuthorityRev(tournamentId, storageSeg);
          }}
        />
      </main>
        <BracketHubModalLayer
          bracketHubModal={bracketHubModal}
          setBracketHubModal={setBracketHubModal}
          multiBlockBusy={multiBlockBusy}
          confirmShuffleRegenAndPost={confirmShuffleRegenAndPost}
          confirmSplitCancelAndPost={confirmSplitCancelAndPost}
          loadLatestBracket={loadLatestBracket}
          tournamentId={tournamentId}
          routerRefresh={() => router.refresh()}
          routerPush={(href) => void router.push(href)}
        />
      </>
    );
  }

  const printStartPlayersHint = useMemo(
    () => printStartPlayersHintFromBracket(bracket, boardSliceKey),
    [bracket, boardSliceKey],
  );

  return (
    <>
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted" style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.45 }}>
        대회 시작 시 대회 카드 상태를 &quot;진행중&quot;으로 변경해 주세요. 상태 변경 시 대회 상세 버튼과 표시 내용이 자동 변경됩니다.
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
              : bracketLooksLikeSplitLayout(bracket)
                ? "조분할 됨 · 분할취소 후 재배치 가능"
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
            <button
              type="button"
              onClick={() =>
                tryOpenBracketCreation(`/client/tournaments/${tournamentId}/bracket/create${bracketZoneQuery}`)
              }
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
                cursor: "pointer",
              }}
            >
              전체 대진표 만들기
            </button>
            <button
              type="button"
              onClick={() =>
                tryOpenBracketCreation(`/client/tournaments/${tournamentId}/bracket/auto${bracketZoneQuery}`)
              }
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
                cursor: "pointer",
              }}
            >
              자동 배정으로 만들기
            </button>
            <button
              type="button"
              onClick={() =>
                tryOpenBracketCreation(`/client/tournaments/${tournamentId}/bracket/manual${bracketZoneQuery}`)
              }
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
                cursor: "pointer",
              }}
            >
              수동 배정으로 만들기
            </button>
          </div>
        ) : (
          <div className="v3-stack" style={{ gap: "0.65rem", width: "100%" }}>
            {!bracketLooksLikeSplitLayout(bracket) && displayRoundsSorted.length > 0 ? (
              <button
                type="button"
                disabled={actionLoading || interactionLocked || multiBlockBusy || bracketHasRecordedWinners}
                onClick={() => {
                  if (!bracket) return;
                  setBracketHubModal({
                    type: "shuffleRegenConfirm",
                    roundNumber: displayRoundsSorted[0]!.roundNumber,
                    scope: shuffleScopeForSlice(bracket, boardSliceKey),
                  });
                }}
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
            ) : bracketLooksLikeSplitLayout(bracket) ? (
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
                조 분할 상태에서는 「대진표 생성/재생성」으로 1라운드를 재배치할 수 없습니다. 「분할취소」로 단일 예선으로 복귀한 뒤 이용하세요.
              </p>
            ) : null}

            {!bracketLooksLikeSplitLayout(bracket) && bracketHasRecordedWinners ? (
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
                승패가 기록된 뒤에는 「대진표 생성/재생성」과 「분할 실행」을 사용할 수 없습니다.
              </p>
            ) : null}

            {hubAutoSectionMessage ? (
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#b45309", fontWeight: 600 }}>
                {hubAutoSectionMessage}
              </p>
            ) : null}

            <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
              <strong style={{ color: "#0f172a" }}>마지막 생성·재생성 시각:</strong>{" "}
              {new Date(bracket.createdAt).toLocaleString("ko-KR")}
            </p>

            {canSplitBracket(bracket) || bracketLooksLikeSplitLayout(bracket) ? (
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
                  조분할은 이미 만들어진 1라운드 대진을 조당 인원 기준으로 나눕니다. 매치 순서·상대는 그대로 두고 조만 나뉩니다.
                  <br />
                  예) 64강을 16명씩 4개 조, 32명씩 2개 조, 8명씩 8개 조 등 입력한 인원 그대로 처리됩니다.
                </p>
                <div
                  className="v3-row"
                  style={{
                    alignItems: "center",
                    gap: "0.45rem",
                    flexWrap: "wrap",
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
                    value={multiBlockSplitSizeFieldValue(bracket, multiBlockSizeDraft)}
                    onChange={(e) => setMultiBlockSizeDraft(e.target.value)}
                    disabled={interactionLocked || bracketLooksLikeSplitLayout(bracket)}
                    aria-label="조당 인원"
                  />
                  <button
                    type="button"
                    className="v3-btn"
                    disabled={
                      actionLoading ||
                      interactionLocked ||
                      multiBlockBusy ||
                      bracketHasRecordedWinners
                    }
                    onClick={() => {
                      const blockSize = parseMultiBlockSplitSizeDraft(multiBlockSizeDraft);
                      if (blockSize === null) {
                        setBracketHubModal({ type: "error", message: "조당 인원을 확인하세요." });
                        return;
                      }
                      if (blockSize < 2) {
                        setBracketHubModal({ type: "error", message: "조당 인원을 확인하세요." });
                        return;
                      }
                      if (bracketLooksLikeSplitLayout(bracket)) {
                        setBracketHubModal({
                          type: "error",
                          message: "이미 조분할된 대진표입니다. 다시 분할하려면 먼저 조분할을 취소하세요.",
                        });
                        return;
                      }
                      if (
                        !window.confirm("단일 대진표가 예선 조와 결선 구조로 변경됩니다. 계속하시겠습니까?")
                      ) {
                        return;
                      }
                      void (async () => {
                        setMultiBlockBusy(true);
                        setMessage("");
                        setHubAutoSectionMessage("");
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
                            setBracketHubModal({
                              type: "error",
                              message: bracketHubFailureModalMessage(json.error),
                            });
                            return;
                          }
                          setBracket(json.bracket);
                          writeLastGoodBracket(tournamentId, storageSeg, json.bracket);
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
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={openSplitCancelConfirmOrExplain}
                    style={{
                      boxShadow: "none",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      minHeight: 34,
                    }}
                    title={
                      !bracketLooksLikeSplitLayout(bracket)
                        ? "조분할된 대진표에서만 사용할 수 있습니다."
                        : !multiBlockSlicesOnlyRoundOne(bracket)
                          ? "예선·결선에 2라운드 이상이 있으면 사용할 수 없습니다. 위험 작업의 전체 초기화를 이용해 주세요."
                          : bracketHasRecordedWinners
                            ? "승패가 있으면 사용할 수 없습니다."
                            : undefined
                    }
                  >
                    분할취소
                  </button>
                </div>
                {bracketLooksLikeSplitLayout(bracket) && !multiBlockSplitCancelAllowed ? (
                  <span className="v3-muted" style={{ fontSize: "0.82rem" }}>
                    {bracketHasRecordedWinners
                      ? "승패가 기록된 경우에는 분할취소를 사용할 수 없습니다. 승패를 모두 되돌린 뒤(예선·결선 1라운드만 남은 상태) 다시 시도하거나, 위험 작업의 전체 초기화를 이용해 주세요."
                      : !multiBlockSlicesOnlyRoundOne(bracket)
                        ? "예선·결선에 2라운드 이상이 있으면 분할취소를 사용할 수 없습니다. 위험 작업의 전체 초기화를 이용해 주세요."
                        : null}
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
            <div className="v3-stack" style={{ gap: "0.35rem", width: "100%", marginBottom: "0.35rem" }}>
              <Link
                prefetch={false}
                href={`/client/tournaments/${encodeURIComponent(tournamentId)}/bracket/attendance${zonesEnabled && selectedZoneId ? `?zoneId=${encodeURIComponent(selectedZoneId)}` : ""}`}
                style={{
                  width: "100%",
                  minHeight: "52px",
                  borderRadius: "8px",
                  border: "1px solid #7c3aed",
                  background: "#7c3aed",
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
                출석 확인
              </Link>
              <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                대회 당일 출석 체크는 「대진표 운영」에서 진행합니다.
              </p>
            </div>
            {bracketLooksLikeSplitLayout(bracket) && bracket.blocks?.length ? (
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
                      {multiBlockBlockButtonLabel(bl)}
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
            {!bracketLooksLikeSplitLayout(bracket) ? <BracketProgressSummaryCard bracket={bracket} /> : null}

            <div className="v3-stack" style={{ gap: "0.5rem", width: "100%" }}>
              <Link
                prefetch={false}
                href={quickResultsHref}
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
                onClick={() => router.push(bracketViewOpsPath)}
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
                대진표 보기
              </button>
            </div>

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
        aria-label="출력 설정"
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
          title="3. 출력 설정"
          summary="전체 화면·TV·인쇄"
          expanded={isAccordionOpen("field")}
          onToggle={() => toggleAccordion("field")}
        >
        <div className="v3-stack" style={{ gap: "0.5rem", width: "100%" }}>
          <button
            type="button"
            onClick={() => router.push(bracketViewMergedFullPath)}
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
          {bracket && bracketLooksLikeSplitLayout(bracket) ? (
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.45 }}>
              예선 조와 결선을 한 화면에 나열합니다. 조 탭 선택과 무관합니다.
            </p>
          ) : null}
          <div>
            <p style={{ margin: "0 0 0.45rem", fontWeight: 800, fontSize: "0.9rem", color: "#0f172a" }}>TV 연결</p>
            <div className="client-tournament-manage" style={{ width: "100%", maxWidth: "100%" }}>
              <TournamentTvLinkBlock tournamentId={tournamentId} />
            </div>
          </div>
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
        </BracketHubAccordionPanel>
      </div>

      {bracket && bracketLooksLikeSplitLayout(bracket) ? (
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
        <BracketHubModalLayer
          bracketHubModal={bracketHubModal}
          setBracketHubModal={setBracketHubModal}
          multiBlockBusy={multiBlockBusy}
          confirmShuffleRegenAndPost={confirmShuffleRegenAndPost}
          confirmSplitCancelAndPost={confirmSplitCancelAndPost}
          loadLatestBracket={loadLatestBracket}
          tournamentId={tournamentId}
          routerRefresh={() => router.refresh()}
          routerPush={(href) => void router.push(href)}
        />
    </>
  );
}
