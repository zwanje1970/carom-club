"use client";

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  applyCaromOrientationMode,
  CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID,
  registerCaromExplicitNativeLandscapeSession,
  unregisterCaromExplicitNativeLandscapeSession,
} from "../../../native-fullscreen-orientation-lock";
import styles from "./interactive-bracket-board.module.css";
import {
  calculateLayout,
  computeBracketBoardMetrics,
  type BoardBracket,
  type BoardMatch,
  type BracketBoardMetrics,
  type BracketLayoutCalculation,
  type ConnectorGeometry,
  type MatchFrame,
  type PositionedBoardMatch,
} from "./bracket-board-layout";
import {
  isEligibleBracketWinnerUserId,
  isPropagatableBracketWinnerLabel,
} from "./bracket-view-server-sync";

type BoardRound = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: BoardMatch[];
};

type BracketBoardInput = {
  id: string;
  rounds: BoardRound[];
};

type BoardPlayerSlot = {
  userId: string;
  name: string;
  displayName?: string | null;
};

const RENAME_LONG_PRESS_MS = 1000;

function bracketSlotLabel(p: { name: string; displayName?: string | null }): string {
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  return d || p.name;
}

/** 대진표 보기 툴바: 가로 전환 안내(폰이 가로로 누운 형태) */
function BracketToolbarPhoneLandscapeGlyph(props: { className?: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="2" y="8" width="20" height="8" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** 대진표 보기 툴바: 세로 전환 안내(폰이 세로로 선 형태) */
function BracketToolbarPhonePortraitGlyph(props: { className?: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="8" y="2" width="8" height="20" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function cloneBracketBoardForLayout(b: BracketBoardInput): BracketBoardInput {
  return {
    ...b,
    rounds: b.rounds.map((r) => ({
      ...r,
      matches: r.matches.map((m) => ({
        ...m,
        player1: {
          ...m.player1,
          name: bracketSlotLabel(m.player1 as BoardPlayerSlot),
        },
        player2: {
          ...m.player2,
          name: bracketSlotLabel(m.player2 as BoardPlayerSlot),
        },
      })),
    })),
  };
}

function readRawSlotPlayer(
  bracketInput: BracketBoardInput,
  roundIndex: number,
  internalIndex: number,
): BoardPlayerSlot | null {
  const round = bracketInput.rounds[roundIndex];
  const match = round?.matches[Math.floor(internalIndex / 2)];
  if (!match) return null;
  return (internalIndex % 2 === 0 ? match.player1 : match.player2) as BoardPlayerSlot;
}

/** 승/패 색상용 — placeholder·부전승 더미 id 제외 */
function slotUserIdForHighlight(raw: BoardPlayerSlot | null): string {
  if (!raw) return "";
  const id = typeof raw.userId === "string" ? raw.userId.trim() : "";
  if (!id || id === "__none" || id.startsWith("__TBD__")) return "";
  return id;
}

function opponentSlotLooksFilled(raw: BoardPlayerSlot | null): boolean {
  if (!raw) return false;
  if (slotUserIdForHighlight(raw)) return true;
  const name = (raw.name ?? "").trim();
  return name !== "" && name !== "대기";
}

function cascadeClearWinnerByPairState(
  prev: Record<string, WinnerChoice>,
  pairKey: string,
  baseRound: number,
  basePair: number,
): Record<string, WinnerChoice> {
  const next: Record<string, WinnerChoice> = { ...prev };
  delete next[pairKey];
  for (const key of Object.keys(next)) {
    const [roundText, pairText] = key.split(":");
    const round = Number(roundText);
    const pair = Number(pairText);
    if (!Number.isFinite(round) || !Number.isFinite(pair)) continue;
    if (round <= baseRound) continue;
    const shift = 2 ** (round - baseRound);
    const affectedPair = Math.floor(basePair / shift);
    if (pair === affectedPair) {
      delete next[key];
    }
  }
  return next;
}

function matchPairHasClearableServerWinner(
  bracketInput: BracketBoardInput,
  roundIndex: number,
  pairIndex: number,
): boolean {
  const m = bracketInput.rounds[roundIndex]?.matches[pairIndex];
  if (!m) return false;
  const w = typeof m.winnerUserId === "string" ? m.winnerUserId.trim() : "";
  if (!w) return false;
  const p1 = m.player1.userId.trim();
  const p2 = m.player2.userId.trim();
  if (w === p1 && isEligibleBracketWinnerUserId(p1)) return true;
  if (w === p2 && isEligibleBracketWinnerUserId(p2)) return true;
  return false;
}

function isReservedWinnerPickDisplay(raw: BoardPlayerSlot | null): boolean {
  if (!raw) return true;
  const label = bracketSlotLabel(raw);
  return !isPropagatableBracketWinnerLabel(label);
}

/** PATCH 본문 displayName: null은 저장 생략, ""는 오버레이 제거 */
function resolveRenameDisplayPayload(
  raw: BoardPlayerSlot | null,
  resolvedSlotLabel: string,
  nextTrimmed: string,
): string | null {
  if (nextTrimmed === "") return "";
  if (nextTrimmed === resolvedSlotLabel) return null;
  const original = raw?.name?.trim() ?? "";
  if (original !== "" && nextTrimmed === original) return "";
  return nextTrimmed;
}

type WinnerChoice = 0 | 1;

function formatDateWithKoreanDow(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return v;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m[1]}-${m[2]}-${m[3]}(${days[dt.getUTCDay()]})`;
}

/** 대진표 상단: 상호(첫 줄·첫 구간)만 — 주소·추가 줄은 `location` 저장 형식에 맞춰 제외 */
function stripVenueAddress(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const lines = v.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const firstLine = lines[0] ?? v;
  const middotParts = firstLine.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  const base = middotParts.length >= 2 ? (middotParts[0] ?? "") : firstLine;
  const slash = base.split("/")[0]?.trim() ?? "";
  const comma = slash.split(",")[0]?.trim() ?? "";
  const pipe = comma.split("|")[0]?.trim() ?? "";
  const paren = pipe.split("(")[0]?.trim() ?? "";
  return paren;
}

type BoardViewMode = "vertical" | "horizontal" | "dual";

const LAYOUT_VIEW_PAD = 14;

function offsetSvgPathD(d: string, ox: number, oy: number): string {
  const parts = d.trim().split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const tok = parts[i] ?? "";
    if (tok === "M" || tok === "L") {
      out.push(tok);
      i += 1;
      const x = Number(parts[i]);
      const y = Number(parts[i + 1]);
      out.push(String(x + ox), String(y + oy));
      i += 2;
    } else {
      out.push(tok);
      i += 1;
    }
  }
  return out.join(" ");
}

function growSvgPathPoints(d: string, grow: (x: number, y: number) => void): void {
  const parts = d.trim().split(/\s+/);
  let i = 0;
  while (i < parts.length) {
    const tok = parts[i];
    if (tok === "M" || tok === "L") {
      grow(Number(parts[i + 1]), Number(parts[i + 2]));
      i += 3;
    } else {
      i += 1;
    }
  }
}

function normalizeLayoutToCanvas(
  positionedMatches: PositionedBoardMatch[],
  connectors: ConnectorGeometry[],
): BracketLayoutCalculation {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const growBox = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  const growPt = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const p of positionedMatches) {
    growBox(p.frame.x, p.frame.y, p.frame.width, p.frame.height);
  }
  for (const c of connectors) {
    for (const path of c.basePaths) {
      growSvgPathPoints(path, growPt);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      positionedMatches,
      connectors,
      roundTitles: [],
      canvasBounds: { width: 400, height: 300 },
    };
  }

  const ox = -minX + LAYOUT_VIEW_PAD;
  const oy = -minY + LAYOUT_VIEW_PAD;
  for (const p of positionedMatches) {
    p.frame.x += ox;
    p.frame.y += oy;
  }
  for (const c of connectors) {
    c.basePaths = c.basePaths.map((path) => offsetSvgPathD(path, ox, oy));
    if (c.winnerPath) c.winnerPath = offsetSvgPathD(c.winnerPath, ox, oy);
  }

  const canvasW = Math.ceil(maxX - minX + 2 * LAYOUT_VIEW_PAD);
  const canvasH = Math.ceil(maxY - minY + 2 * LAYOUT_VIEW_PAD);
  return {
    positionedMatches,
    connectors,
    roundTitles: [],
    canvasBounds: { width: canvasW, height: canvasH },
  };
}

/** 좌표 이동 없이 최소 캔버스 크기와 실제 bbox를 맞춘다 */
function layoutBoundsWithMinimum(
  positionedMatches: PositionedBoardMatch[],
  connectors: ConnectorGeometry[],
  minCanvasW: number,
  minCanvasH: number,
): BracketLayoutCalculation {
  let maxX = 0;
  let maxY = 0;
  const growBox = (x: number, y: number, w: number, h: number) => {
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  const growPt = (x: number, y: number) => {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of positionedMatches) {
    growBox(p.frame.x, p.frame.y, p.frame.width, p.frame.height);
  }
  for (const c of connectors) {
    for (const path of c.basePaths) {
      growSvgPathPoints(path, growPt);
    }
  }
  const pad = LAYOUT_VIEW_PAD;
  return {
    positionedMatches,
    connectors,
    roundTitles: [],
    canvasBounds: {
      width: Math.max(minCanvasW, Math.ceil(maxX + pad)),
      height: Math.max(minCanvasH, Math.ceil(maxY + pad)),
    },
  };
}

function leafSpan(roundIdx: number, internalIndex: number): { lo: number; hi: number } {
  const span = 2 ** roundIdx;
  return { lo: internalIndex * span, hi: internalIndex * span + span - 1 };
}

function dualSide(lo: number, hi: number, half: number): "left" | "right" | "center" {
  if (hi < half) return "left";
  if (lo >= half) return "right";
  return "center";
}

/** 슬롯 키·connector 키는 세로형과 동일. 가로형 전용 좌표·캔버스(세로형 metrics 미사용) */
function layoutHorizontalFromVerticalBase(
  base: BracketLayoutCalculation,
  _metrics: BracketBoardMetrics,
): BracketLayoutCalculation {
  const LEFT_PAD = 120;
  const RIGHT_PAD = 120;
  const TOP_PAD = 100;
  const SLOT_W = 160;
  const SLOT_H = 36;
  const ROUND_GAP = 265;
  const SLOT_GAP = 18;
  const slotPitch = SLOT_H + SLOT_GAP;

  const byRound = new Map<number, PositionedBoardMatch[]>();
  for (const p of base.positionedMatches) {
    const arr = byRound.get(p.roundIndex) ?? [];
    arr.push(p);
    byRound.set(p.roundIndex, arr);
  }
  const maxRi = Math.max(0, ...byRound.keys());
  const slotRounds = maxRi + 1;
  for (const arr of byRound.values()) arr.sort((a, b) => a.internalIndex - b.internalIndex);

  const firstRow = byRound.get(0) ?? [];
  const nLeaf = firstRow.length;
  if (nLeaf === 0) return base;

  const FINAL_WINNER_SLOT_SCALE = 2;
  const roundCount = slotRounds;
  const canvasW =
    LEFT_PAD + Math.max(0, roundCount - 1) * ROUND_GAP + SLOT_W * FINAL_WINNER_SLOT_SCALE + RIGHT_PAD;
  const canvasH = TOP_PAD * 2 + nLeaf * slotPitch;

  const centerY: number[][] = [];
  const row0: number[] = [];
  for (let i = 0; i < nLeaf; i += 1) {
    row0.push(TOP_PAD + i * slotPitch + SLOT_H / 2);
  }
  centerY.push(row0);
  for (let r = 1; r < slotRounds; r += 1) {
    const prev = centerY[r - 1]!;
    const next: number[] = [];
    for (let j = 0; j < prev.length / 2; j += 1) {
      next.push((prev[2 * j]! + prev[2 * j + 1]!) / 2);
    }
    centerY.push(next);
  }

  const oldByKey = new Map(base.positionedMatches.map((p) => [p.key, p]));
  const positionedMatches: PositionedBoardMatch[] = [];

  for (let r = 0; r < slotRounds; r += 1) {
    const row = byRound.get(r) ?? [];
    for (const item of row) {
      const cy = centerY[r]![item.internalIndex]!;
      const x = LEFT_PAD + r * ROUND_GAP;
      const orig = oldByKey.get(item.key)!;
      positionedMatches.push({
        ...orig,
        frame: { x, y: cy - SLOT_H / 2, width: SLOT_W, height: SLOT_H },
      });
    }
  }

  const finalRi = slotRounds - 1;
  for (const item of positionedMatches) {
    if (item.roundIndex !== finalRi) continue;
    const f = item.frame;
    const midY = f.y + f.height / 2;
    const nw = f.width * FINAL_WINNER_SLOT_SCALE;
    const nh = f.height * FINAL_WINNER_SLOT_SCALE;
    item.frame = { x: f.x, y: midY - nh / 2, width: nw, height: nh };
  }

  const frameAt = (roundIdx: number, internalIndex: number): MatchFrame | null => {
    const it = positionedMatches.find((p) => p.roundIndex === roundIdx && p.internalIndex === internalIndex);
    return it?.frame ?? null;
  };

  const connectors: ConnectorGeometry[] = [];
  for (let r = 0; r < slotRounds - 1; r += 1) {
    const childCount = byRound.get(r)?.length ?? 0;
    const parentCount = byRound.get(r + 1)?.length ?? 0;
    for (let j = 0; j < parentCount; j += 1) {
      const c0 = frameAt(r, 2 * j);
      const c1 = frameAt(r, 2 * j + 1);
      const p = frameAt(r + 1, j);
      if (!c0 || !p) continue;

      const px = p.x;
      const py = p.y + p.height / 2;

      if (!c1 || 2 * j + 1 >= childCount) {
        const c0rx = c0.x + c0.width;
        const c0cy = c0.y + c0.height / 2;
        const midX = c0rx + Math.max(40, (px - c0rx) * 0.55);
        connectors.push({
          key: `${r + 1}:${2 * j}->${r + 2}:${j}`,
          basePaths: [`M ${c0rx} ${c0cy} L ${midX} ${c0cy} L ${midX} ${py} L ${px} ${py}`],
          winnerPath: null,
        });
        continue;
      }

      const c0rx = c0.x + c0.width;
      const c0cy = c0.y + c0.height / 2;
      const c1rx = c1.x + c1.width;
      const c1cy = c1.y + c1.height / 2;
      const mergeY = (c0cy + c1cy) / 2;
      const mergeX = Math.max(c0rx, c1rx) + Math.max(48, (px - Math.max(c0rx, c1rx)) * 0.55);

      connectors.push({
        key: `${r + 1}:${2 * j}+${r + 1}:${2 * j + 1}->${r + 2}:${j}`,
        basePaths: [
          `M ${c0rx} ${c0cy} L ${mergeX} ${c0cy} L ${mergeX} ${mergeY}`,
          `M ${c1rx} ${c1cy} L ${mergeX} ${c1cy} L ${mergeX} ${mergeY}`,
          `M ${mergeX} ${mergeY} L ${px} ${mergeY} L ${px} ${py}`,
        ],
        winnerPath: null,
      });
    }
  }

  return layoutBoundsWithMinimum(positionedMatches, connectors, canvasW, canvasH);
}

function layoutDualFromVerticalBase(
  base: BracketLayoutCalculation,
  _metrics: BracketBoardMetrics,
): BracketLayoutCalculation {
  const ORIGIN_LEFT = 120;
  const ORIGIN_RIGHT = 120;
  const TOP_PAD = 100;
  const SLOT_W = 160;
  const SLOT_H = 36;
  const SLOT_GAP = 18;
  const slotPitch = SLOT_H + SLOT_GAP;
  /** 라운드 간 수평 간격(경로선 길이) */
  const STEP = 265;
  /** [좌 트리] — finalGap — [마지막 라운드 1슬롯, 캔버스 중앙] — finalGap — [우 트리] */
  const FINAL_GAP = 340;

  const byRound = new Map<number, PositionedBoardMatch[]>();
  for (const p of base.positionedMatches) {
    const arr = byRound.get(p.roundIndex) ?? [];
    arr.push(p);
    byRound.set(p.roundIndex, arr);
  }
  const maxRi = Math.max(0, ...byRound.keys());
  const slotRounds = maxRi + 1;
  for (const arr of byRound.values()) arr.sort((a, b) => a.internalIndex - b.internalIndex);

  const firstRow = byRound.get(0) ?? [];
  const nLeaf = firstRow.length;
  if (nLeaf === 0) return base;

  const half = nLeaf / 2;
  const innerSteps = Math.max(0, slotRounds - 2);
  const semiRi = slotRounds - 2;
  const finalRi = slotRounds - 1;

  const leftInnerRight = ORIGIN_LEFT + innerSteps * STEP + SLOT_W;
  /** 마지막 라운드 슬롯 중심 = canvasW/2, 좌·우 트리 끝과 FINAL_GAP 이상 */
  const minHalfCenterX = leftInnerRight + FINAL_GAP + SLOT_W / 2;
  const canvasW = 2 * minHalfCenterX;

  const xLeftForRound = (r: number): number => ORIGIN_LEFT + r * STEP;
  const xRightForRound = (r: number): number => canvasW - ORIGIN_RIGHT - SLOT_W - r * STEP;

  const centerY: number[][] = [];
  const row0: number[] = [];
  for (let i = 0; i < nLeaf; i += 1) {
    if (i < half) {
      row0.push(TOP_PAD + i * slotPitch + SLOT_H / 2);
    } else {
      row0.push(TOP_PAD + (i - half) * slotPitch + SLOT_H / 2);
    }
  }
  centerY.push(row0);
  for (let r = 1; r < slotRounds; r += 1) {
    const prev = centerY[r - 1]!;
    const next: number[] = [];
    for (let j = 0; j < prev.length / 2; j += 1) {
      next.push((prev[2 * j]! + prev[2 * j + 1]!) / 2);
    }
    centerY.push(next);
  }

  const canvasH = TOP_PAD * 2 + half * slotPitch;

  const oldByKey = new Map(base.positionedMatches.map((p) => [p.key, p]));
  const positionedMatches: PositionedBoardMatch[] = [];

  const semiRowLen = byRound.get(semiRi)?.length ?? 0;

  for (let r = 0; r < slotRounds; r += 1) {
    const row = byRound.get(r) ?? [];
    for (const item of row) {
      const { lo, hi } = leafSpan(r, item.internalIndex);
      const side = dualSide(lo, hi, half);
      let cy = centerY[r]![item.internalIndex]!;
      if (r === finalRi && side === "center" && semiRowLen >= 2) {
        cy = (centerY[semiRi]![0]! + centerY[semiRi]![1]!) / 2;
      }
      let x: number;
      if (side === "left") {
        x = xLeftForRound(r);
      } else if (side === "right") {
        x = xRightForRound(r);
      } else {
        x = canvasW / 2 - SLOT_W / 2;
      }

      const orig = oldByKey.get(item.key)!;
      positionedMatches.push({
        ...orig,
        frame: { x, y: cy - SLOT_H / 2, width: SLOT_W, height: SLOT_H },
      });
    }
  }

  const CENTER_SLOT_SCALE = 2;
  for (const item of positionedMatches) {
    const { lo, hi } = leafSpan(item.roundIndex, item.internalIndex);
    if (dualSide(lo, hi, half) !== "center") continue;
    const f = item.frame;
    const midX = f.x + f.width / 2;
    const midY = f.y + f.height / 2;
    const nw = f.width * CENTER_SLOT_SCALE;
    const nh = f.height * CENTER_SLOT_SCALE;
    item.frame = { x: midX - nw / 2, y: midY - nh / 2, width: nw, height: nh };
  }

  const frameAt = (roundIdx: number, internalIndex: number): MatchFrame | null => {
    const it = positionedMatches.find((p) => p.roundIndex === roundIdx && p.internalIndex === internalIndex);
    return it?.frame ?? null;
  };

  const orthLR = (c: MatchFrame, p: MatchFrame): string => {
    const cx = c.x + c.width;
    const cy = c.y + c.height / 2;
    const px = p.x;
    const py = p.y + p.height / 2;
    const mx = cx + Math.max(52, (px - cx) * 0.52);
    return `M ${cx} ${cy} L ${mx} ${cy} L ${mx} ${py} L ${px} ${py}`;
  };

  const orthRL = (c: MatchFrame, p: MatchFrame): string => {
    const cx = c.x;
    const cy = c.y + c.height / 2;
    const px = p.x + p.width;
    const py = p.y + p.height / 2;
    const mx = cx - Math.max(52, (cx - px) * 0.52);
    return `M ${cx} ${cy} L ${mx} ${cy} L ${mx} ${py} L ${px} ${py}`;
  };

  const connectors: ConnectorGeometry[] = [];

  for (let r = 0; r < slotRounds - 1; r += 1) {
    const childCount = byRound.get(r)?.length ?? 0;
    const parentCount = byRound.get(r + 1)?.length ?? 0;
    for (let j = 0; j < parentCount; j += 1) {
      const c0 = frameAt(r, 2 * j);
      const c1 = frameAt(r, 2 * j + 1);
      const p = frameAt(r + 1, j);
      if (!c0 || !p) continue;

      const pSide = dualSide(leafSpan(r + 1, j).lo, leafSpan(r + 1, j).hi, half);

      if (!c1 || 2 * j + 1 >= childCount) {
        const s0 = dualSide(leafSpan(r, 2 * j).lo, leafSpan(r, 2 * j).hi, half);
        const path =
          s0 === "right" || pSide === "center"
            ? orthRL(c0, p)
            : orthLR(c0, p);
        connectors.push({
          key: `${r + 1}:${2 * j}->${r + 2}:${j}`,
          basePaths: [path],
          winnerPath: null,
        });
        continue;
      }

      const s0 = dualSide(leafSpan(r, 2 * j).lo, leafSpan(r, 2 * j).hi, half);
      const s1 = dualSide(leafSpan(r, 2 * j + 1).lo, leafSpan(r, 2 * j + 1).hi, half);

      if (pSide === "center" && s0 === "left" && s1 === "right") {
        const py = p.y + p.height / 2;
        const plx = p.x;
        const prx = p.x + p.width;
        const Lrx = c0.x + c0.width;
        const Ly = c0.y + c0.height / 2;
        const Rlx = c1.x;
        const Ry = c1.y + c1.height / 2;
        const stubL = Math.min(STEP, Math.max(52, (plx - Lrx) * 0.52));
        const stubR = Math.min(STEP, Math.max(52, (Rlx - prx) * 0.52));
        const mxL = Math.max(Lrx + 48, Math.min(plx - 48, Lrx + stubL));
        const mxR = Math.min(Rlx - 48, Math.max(prx + 48, Rlx - stubR));
        connectors.push({
          key: `${r + 1}:${2 * j}+${r + 1}:${2 * j + 1}->${r + 2}:${j}`,
          basePaths: [
            `M ${Lrx} ${Ly} L ${mxL} ${Ly} L ${mxL} ${py} L ${plx} ${py}`,
            `M ${Rlx} ${Ry} L ${mxR} ${Ry} L ${mxR} ${py} L ${prx} ${py}`,
          ],
          winnerPath: null,
        });
        continue;
      }

      if (s0 === "right" && s1 === "right") {
        const c0lx = c0.x;
        const c0cy = c0.y + c0.height / 2;
        const c1lx = c1.x;
        const c1cy = c1.y + c1.height / 2;
        const prx = p.x + p.width;
        const py = p.y + p.height / 2;
        const mergeY = (c0cy + c1cy) / 2;
        const loEdge = Math.min(c0lx, c1lx);
        const mergeX = Math.max(prx + 48, loEdge - Math.max(52, (loEdge - prx) * 0.52));
        connectors.push({
          key: `${r + 1}:${2 * j}+${r + 1}:${2 * j + 1}->${r + 2}:${j}`,
          basePaths: [
            `M ${c0lx} ${c0cy} L ${mergeX} ${c0cy} L ${mergeX} ${mergeY}`,
            `M ${c1lx} ${c1cy} L ${mergeX} ${c1cy} L ${mergeX} ${mergeY}`,
            `M ${mergeX} ${mergeY} L ${prx} ${mergeY} L ${prx} ${py}`,
          ],
          winnerPath: null,
        });
        continue;
      }

      const c0rx = c0.x + c0.width;
      const c0cy = c0.y + c0.height / 2;
      const c1rx = c1.x + c1.width;
      const c1cy = c1.y + c1.height / 2;
      const plx = p.x;
      const py = p.y + p.height / 2;
      const mergeY = (c0cy + c1cy) / 2;
      const mergeX = Math.max(c0rx, c1rx) + Math.max(52, (plx - Math.max(c0rx, c1rx)) * 0.52);
      connectors.push({
        key: `${r + 1}:${2 * j}+${r + 1}:${2 * j + 1}->${r + 2}:${j}`,
        basePaths: [
          `M ${c0rx} ${c0cy} L ${mergeX} ${c0cy} L ${mergeX} ${mergeY}`,
          `M ${c1rx} ${c1cy} L ${mergeX} ${c1cy} L ${mergeX} ${mergeY}`,
          `M ${mergeX} ${mergeY} L ${plx} ${mergeY} L ${plx} ${py}`,
        ],
        winnerPath: null,
      });
    }
  }

  return layoutBoundsWithMinimum(positionedMatches, connectors, canvasW, canvasH);
}

export default function InteractiveBracketBoard({
  bracket,
  tournamentTitle = "",
  tournamentDate = "",
  tournamentLocation = "",
  onPickWinner,
  onClearMatchWinner,
  onSwapPlayers,
  onRenamePlayer,
  onShuffleRound,
  /** true면 「현재 라운드 재배치」(랜덤 재배치) 숨김 — 조분할 등 */
  shuffleRoundHidden = false,
  interactionDisabled = false,
  actionBusy = false,
  canUndo = false,
  onUndo,
  saveStateText = "",
  chromeMode = "default",
  bracketViewSlicePicker = null,
  bracketViewZones = null,
  bracketViewNotice = "",
  viewStateStorageKey,
  connectivityHint = "",
  onExit,
}: {
  bracket: BracketBoardInput;
  tournamentTitle?: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  /** bracket/view 전용: 모바일에서 헤더·양쪽형 등 간소화 */
  chromeMode?: "default" | "bracketView";
  /** 분할 대진표: 조·결선 선택 — 상단 노출 대신 툴바 모달 */
  bracketViewSlicePicker?: {
    blocks: Array<{ id: string; label?: string | null }>;
    hasFinal: boolean;
    boardSliceKey: string | null;
    onSliceChange: (sliceKey: string | null) => void;
  } | null;
  /** 권역 대회: 툴바에서 권역 선택 모달 */
  bracketViewZones?: {
    options: Array<{ id: string; zoneName: string }>;
    selectedId: string;
    onChange: (zoneId: string) => void;
  } | null;
  /** 모바일 등 헤더 없을 때 상태 메시지 */
  bracketViewNotice?: string;
  /** bracketView: 가로/세로·확대·스크롤 sessionStorage 키(부모에서 고정 문자열) */
  viewStateStorageKey?: string;
  /** bracketView: 오프라인·재동기화 등 짧은 연결 상태 문구 */
  connectivityHint?: string;
  /** 모바일 툴바 나가기 (이동은 부모 handleExit에서 처리) */
  onExit?: () => void;
  onPickWinner?: (args: { matchId: string; winnerUserId: string; roundNumber: number }) => void | Promise<void>;
  /** 제공 시 진출 취소(×) 시 서버에 승자 해제 반영 (부모에서 처리) */
  onClearMatchWinner?: (args: { matchId: string }) => boolean | Promise<boolean>;
  onSwapPlayers?: (args: {
    roundNumber: number;
    first: { matchId: string; slot: "player1" | "player2" };
    second: { matchId: string; slot: "player1" | "player2" };
  }) => void | Promise<void>;
  onRenamePlayer?: (args: {
    roundNumber: number;
    matchId: string;
    slot: "player1" | "player2";
    displayName: string;
  }) => void | Promise<void>;
  onShuffleRound?: (roundNumber: number) => void | Promise<void>;
  shuffleRoundHidden?: boolean;
  interactionDisabled?: boolean;
  actionBusy?: boolean;
  canUndo?: boolean;
  onUndo?: () => void | Promise<void>;
  saveStateText?: string;
}) {
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.5;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boxPointerStartRef = useRef<Map<number, { x: number; y: number; ts: number }>>(new Map());
  const pinchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistanceRef = useRef<number>(0);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const lastTapRef = useRef<{ key: string; ts: number }>({ key: "", ts: 0 });
  const scaleRef = useRef(1);
  const [viewMode, setViewMode] = useState<BoardViewMode>("vertical");
  const [interactionMode, setInteractionMode] = useState<"winner" | "editSwap">("winner");
  const [selectedBoxKey, setSelectedBoxKey] = useState("");
  const [swapCandidate, setSwapCandidate] = useState<{
    key: string;
    roundNumber: number;
    matchId: string;
    slot: "player1" | "player2";
  } | null>(null);
  const [renameEditing, setRenameEditing] = useState<{
    roundNumber: number;
    roundIndex: number;
    internalIndex: number;
    matchId: string;
    slot: "player1" | "player2";
    value: string;
  } | null>(null);
  const [winnerByPair, setWinnerByPair] = useState<Record<string, WinnerChoice>>({});
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const longPressTimerRef = useRef<number | null>(null);
  /** 모바일 대진표 보기: 툴바 접기(기본 접힘) */
  const [mobileToolbarExpanded, setMobileToolbarExpanded] = useState(false);
  const [isMobileBracketViewLayout, setIsMobileBracketViewLayout] = useState(false);
  const [bracketViewModal, setBracketViewModal] = useState<null | "slice" | "zone">(null);
  const [toolbarLayoutIsLandscape, setToolbarLayoutIsLandscape] = useState(false);

  const scrollResetSigRef = useRef("");
  const viewStateHydratedForKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || chromeMode !== "bracketView") {
      return;
    }
    const sync = () => setToolbarLayoutIsLandscape(window.matchMedia("(orientation: landscape)").matches);
    sync();
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [chromeMode]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || chromeMode !== "bracketView") {
      setIsMobileBracketViewLayout(false);
      return;
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      const narrow = mq.matches;
      setIsMobileBracketViewLayout(narrow);
      if (!narrow) setMobileToolbarExpanded(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [chromeMode]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const sync = () => {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      setViewportSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(viewport);
    return () => ro.disconnect();
  }, []);
  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  const bracketForLayout = useMemo(() => cloneBracketBoardForLayout(bracket), [bracket]);

  const metrics = useMemo<BracketBoardMetrics>(
    () => computeBracketBoardMetrics(bracketForLayout as BoardBracket, "vertical"),
    [bracketForLayout],
  );

  const layoutVerticalBase = useMemo(
    () => calculateLayout(bracketForLayout as BoardBracket, metrics, "vertical"),
    [bracketForLayout, metrics],
  );

  const layoutComputed = useMemo(() => {
    if (viewMode === "vertical") return layoutVerticalBase;
    if (viewMode === "horizontal") return layoutHorizontalFromVerticalBase(layoutVerticalBase, metrics);
    return layoutDualFromVerticalBase(layoutVerticalBase, metrics);
  }, [layoutVerticalBase, metrics, viewMode]);

  const canvasWidth = layoutComputed.canvasBounds?.width ?? metrics.canvasWidth;
  const canvasHeight = layoutComputed.canvasBounds?.height ?? metrics.canvasHeight;

  const clampScale = useCallback((v: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, v)), []);

  /** 세로형: 하단 중심 / 가로형: 왼쪽·세로 중앙 / 양쪽형: 캔버스 중앙 */
  const scrollViewportToDefault = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (viewMode === "vertical") {
      viewport.scrollTo({ left: maxLeft / 2, top: maxTop, behavior: "auto" });
      return;
    }
    if (viewMode === "horizontal") {
      viewport.scrollTo({ left: 0, top: maxTop / 2, behavior: "auto" });
      return;
    }
    viewport.scrollTo({ left: maxLeft / 2, top: maxTop / 2, behavior: "auto" });
  }, [viewMode]);

  const applyScaleAtPoint = useCallback(
    (nextRawScale: number, mouseX: number, mouseY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const oldScale = scaleRef.current;
      const nextScale = clampScale(nextRawScale);
      if (Math.abs(nextScale - oldScale) < 0.0001) return;
      const canvasOffsetX = viewport.clientWidth / 2;
      const canvasOffsetY = viewport.clientHeight / 2;
      const canvasX = (viewport.scrollLeft + mouseX - canvasOffsetX) / oldScale;
      const canvasY = (viewport.scrollTop + mouseY - canvasOffsetY) / oldScale;
      setScale(nextScale);
      scaleRef.current = nextScale;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const vp = viewportRef.current;
          if (!vp) return;
          const ox = vp.clientWidth / 2;
          const oy = vp.clientHeight / 2;
          vp.scrollLeft = canvasX * nextScale + ox - mouseX;
          vp.scrollTop = canvasY * nextScale + oy - mouseY;
        });
      });
    },
    [clampScale],
  );

  const zoomFromViewportCenter = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      applyScaleAtPoint(scaleRef.current * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
    },
    [applyScaleAtPoint],
  );

  const fitBracketToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || canvasWidth <= 0 || canvasHeight <= 0) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    let next = Math.min(vw / canvasWidth, vh / canvasHeight) * 0.95;
    next = clampScale(next);
    setScale(next);
    scaleRef.current = next;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const maxLeft = Math.max(0, vp.scrollWidth - vp.clientWidth);
        const maxTop = Math.max(0, vp.scrollHeight - vp.clientHeight);
        vp.scrollLeft = maxLeft / 2;
        vp.scrollTop = maxTop / 2;
      });
    });
  }, [canvasWidth, canvasHeight, clampScale]);

  const resetBracketView = useCallback(() => {
    setScale(1);
    scaleRef.current = 1;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.scrollLeft = 0;
        vp.scrollTop = 0;
      });
    });
  }, []);

  const handleViewportWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0017);
      applyScaleAtPoint(scaleRef.current * factor, mouseX, mouseY);
    },
    [applyScaleAtPoint],
  );

  const onViewportPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const elTarget = e.target as HTMLElement | null;
    if (elTarget?.closest("[data-bracket-toolbar]")) return;

    if (e.pointerType === "touch") {
      pinchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchPointsRef.current.size === 2) {
        const pts = Array.from(pinchPointsRef.current.values());
        pinchDistanceRef.current = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      }
      return;
    }
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-player-box='1'], input, button, select, textarea, a")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    panDragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(e.pointerId);
    setIsPanning(true);
  }, []);

  const onViewportPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") {
        if (panDragRef.current?.pointerId !== e.pointerId) return;
        const viewport = viewportRef.current;
        if (!viewport) return;
        e.preventDefault();
        const dx = e.clientX - panDragRef.current.x;
        const dy = e.clientY - panDragRef.current.y;
        viewport.scrollLeft = panDragRef.current.left - dx;
        viewport.scrollTop = panDragRef.current.top - dy;
        return;
      }
      if (e.pointerType !== "touch") return;
      if (!pinchPointsRef.current.has(e.pointerId)) return;
      pinchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchPointsRef.current.size !== 2) return;
      const pts = Array.from(pinchPointsRef.current.values());
      const prevDist = pinchDistanceRef.current;
      const nextDist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (prevDist <= 0 || nextDist <= 0) {
        pinchDistanceRef.current = nextDist;
        return;
      }
      e.preventDefault();
      const ratio = nextDist / prevDist;
      const midX = (pts[0]!.x + pts[1]!.x) / 2;
      const midY = (pts[0]!.y + pts[1]!.y) / 2;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      applyScaleAtPoint(scaleRef.current * ratio, midX - rect.left, midY - rect.top);
      pinchDistanceRef.current = nextDist;
    },
    [applyScaleAtPoint],
  );

  const onViewportPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") {
      if (panDragRef.current?.pointerId === e.pointerId) {
        const viewport = viewportRef.current;
        if (viewport?.hasPointerCapture(e.pointerId)) {
          viewport.releasePointerCapture(e.pointerId);
        }
        panDragRef.current = null;
        setIsPanning(false);
      }
      return;
    }
    if (e.pointerType !== "touch") return;
    pinchPointsRef.current.delete(e.pointerId);
    if (pinchPointsRef.current.size < 2) {
      pinchDistanceRef.current = 0;
    }
  }, []);

  useLayoutEffect(() => {
    const bracketId = bracket?.id ?? "";
    const key = viewStateStorageKey;

    if (key && chromeMode === "bracketView" && viewStateHydratedForKeyRef.current !== key) {
      viewStateHydratedForKeyRef.current = key;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const o = JSON.parse(raw) as {
            viewMode?: unknown;
            scale?: unknown;
            scrollLeft?: unknown;
            scrollTop?: unknown;
          };
          let vmForSig: BoardViewMode = viewMode;
          const vm = o.viewMode;
          if (vm === "vertical" || vm === "horizontal" || vm === "dual") {
            setViewMode(vm);
            vmForSig = vm;
          }
          if (typeof o.scale === "number" && Number.isFinite(o.scale)) {
            const c = clampScale(o.scale);
            setScale(c);
            scaleRef.current = c;
          }
          scrollResetSigRef.current = `${bracketId}|${vmForSig}`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const vp = viewportRef.current;
              if (!vp) return;
              if (typeof o.scrollLeft === "number" && Number.isFinite(o.scrollLeft)) {
                vp.scrollLeft = o.scrollLeft;
              }
              if (typeof o.scrollTop === "number" && Number.isFinite(o.scrollTop)) {
                vp.scrollTop = o.scrollTop;
              }
            });
          });
          return;
        }
      } catch {
        /* ignore corrupt storage */
      }
    }

    const sig = `${bracketId}|${viewMode}`;
    if (scrollResetSigRef.current !== sig) {
      scrollResetSigRef.current = sig;
      scrollViewportToDefault();
    }
  }, [bracket?.id, chromeMode, clampScale, scrollViewportToDefault, viewMode, viewStateStorageKey]);

  useEffect(() => {
    if (!viewStateStorageKey || chromeMode !== "bracketView") return;
    if (typeof window === "undefined") return;
    const persist = () => {
      try {
        const vp = viewportRef.current;
        if (!vp) return;
        sessionStorage.setItem(
          viewStateStorageKey,
          JSON.stringify({
            viewMode,
            scale,
            scrollLeft: vp.scrollLeft,
            scrollTop: vp.scrollTop,
          }),
        );
      } catch {
        /* ignore quota / private mode */
      }
    };
    const id = window.setInterval(persist, 1600);
    window.addEventListener("pagehide", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      window.clearInterval(id);
      persist();
    };
  }, [chromeMode, scale, viewMode, viewStateStorageKey]);

  const activeLayout = layoutComputed;

  const derived = useMemo(() => {
    const roundMap = new Map<number, typeof activeLayout.positionedMatches>();
    for (const item of activeLayout.positionedMatches) {
      const arr = roundMap.get(item.roundIndex) ?? [];
      arr.push(item);
      roundMap.set(item.roundIndex, arr);
    }
    for (const arr of roundMap.values()) {
      arr.sort((a, b) => a.internalIndex - b.internalIndex);
    }
    const maxRoundIndex = roundMap.size > 0 ? Math.max(...roundMap.keys()) : -1;
    const labelsByRound: string[][] = [];
    const chosenByPair = new Map<string, WinnerChoice>();
    const activeConnectorKeys = new Set<string>();

    for (let r = 0; r <= maxRoundIndex; r += 1) {
      const row = roundMap.get(r) ?? [];
      const rowLabels = Array.from({ length: row.length }, (_, idx) => {
        const raw = row[idx]?.match.player1.name?.trim() ?? "";
        return raw === "대기" ? "" : raw;
      });
      labelsByRound[r] = rowLabels;
    }

    for (let r = 1; r <= maxRoundIndex; r += 1) {
      const parentRow = roundMap.get(r) ?? [];
      const childLabels = labelsByRound[r - 1] ?? [];
      const parentLabels = [...(labelsByRound[r] ?? Array.from({ length: parentRow.length }, () => ""))];
      for (let j = 0; j < parentRow.length; j += 1) {
        const a = childLabels[2 * j] ?? "";
        const b = childLabels[2 * j + 1] ?? "";
        const pairKey = `${r - 1}:${j}`;
        const selected = winnerByPair[pairKey];
        if (selected !== 0 && selected !== 1) continue;
        const choice = selected;
        const srcMatch = bracket.rounds[r - 1]?.matches[j];
        if (!srcMatch) continue;
        const chosenPlayer = choice === 0 ? srcMatch.player1 : srcMatch.player2;
        const chosenRealId = typeof chosenPlayer.userId === "string" ? chosenPlayer.userId.trim() : "";
        /* 표시 전파: 서버 winnerUserId 반영 전에도 로컬 픽(winnerByPair)으로 상위 라벨 표시. 저장 가능 id/라벨만. */
        if (!isEligibleBracketWinnerUserId(chosenRealId)) continue;
        const chosenLabel = choice === 0 ? a : b;
        if (!isPropagatableBracketWinnerLabel(chosenLabel)) continue;
        parentLabels[j] = chosenLabel;
        chosenByPair.set(pairKey, choice);
        const childRoundNo = r;
        const parentRoundNo = r + 1;
        activeConnectorKeys.add(`pair:${childRoundNo}:${2 * j + choice}`);
        activeConnectorKeys.add(`${childRoundNo}:${2 * j}+${childRoundNo}:${2 * j + 1}->${parentRoundNo}:${j}`);
      }
      labelsByRound[r] = parentLabels;
    }

    const labelByItemKey = new Map<string, string>();
    const winnerByItemKey = new Map<string, boolean>();
    const loserByItemKey = new Map<string, boolean>();
    const opponentHasNameByItemKey = new Map<string, boolean>();
    for (let r = 0; r <= maxRoundIndex; r += 1) {
      const row = roundMap.get(r) ?? [];
      const labels = labelsByRound[r] ?? [];
      const parentRoundExists = r + 1 <= maxRoundIndex;
      for (let s = 0; s < row.length; s += 1) {
        const item = row[s];
        if (!item) continue;
        const label = labels[s] ?? "";
        labelByItemKey.set(item.key, label);
        const pairIdx = Math.floor(s / 2);
        const pairBase = pairIdx * 2;
        const selfInPair = s - pairBase;
        const oppIdx = pairBase + (selfInPair === 0 ? 1 : 0);

        const selfRaw = readRawSlotPlayer(bracket, r, s);
        const oppRaw = readRawSlotPlayer(bracket, r, oppIdx);
        const parentRaw = parentRoundExists ? readRawSlotPlayer(bracket, r + 1, pairIdx) : null;

        const selfId = slotUserIdForHighlight(selfRaw);
        const oppId = slotUserIdForHighlight(oppRaw);
        const parentId = slotUserIdForHighlight(parentRaw);

        let isWinner = Boolean(selfId && parentId && selfId === parentId);
        let isLoser = Boolean(selfId && oppId && parentId && parentId === oppId && selfId !== parentId);

        const pairPickKey = `${r}:${pairIdx}`;
        const picked = winnerByPair[pairPickKey];
        const srcMatchForPick = bracket.rounds[r]?.matches[pairIdx];
        if (!parentId && srcMatchForPick && (picked === 0 || picked === 1) && selfId) {
          const chosenPlayer = picked === 0 ? srcMatchForPick.player1 : srcMatchForPick.player2;
          const chosenRealId =
            typeof chosenPlayer.userId === "string" ? chosenPlayer.userId.trim() : "";
          if (isEligibleBracketWinnerUserId(chosenRealId)) {
            if (picked === selfInPair && selfId === chosenRealId) {
              isWinner = true;
              isLoser = false;
            } else if (oppId) {
              isLoser = true;
              isWinner = false;
            }
          }
        }

        opponentHasNameByItemKey.set(item.key, opponentSlotLooksFilled(oppRaw));
        winnerByItemKey.set(item.key, isWinner);
        loserByItemKey.set(item.key, isLoser);
      }
    }

    return { labelByItemKey, winnerByItemKey, loserByItemKey, opponentHasNameByItemKey, activeConnectorKeys, chosenByPair };
  }, [activeLayout.positionedMatches, bracket, winnerByPair]);

  const handleWinnerPick = useCallback(
    (args: {
      matchId: string;
      winnerUserId: string;
      roundNumber: number;
      roundIndex: number;
      internalIndex: number;
      opponentHasName: boolean;
    }) => {
      if (interactionDisabled) return;
      const rawPick = readRawSlotPlayer(bracket, args.roundIndex, args.internalIndex);
      const pickedUid = typeof rawPick?.userId === "string" ? rawPick.userId.trim() : "";
      if (!isEligibleBracketWinnerUserId(pickedUid)) return;
      if (isReservedWinnerPickDisplay(rawPick)) return;
      if (pickedUid !== args.winnerUserId.trim()) return;
      if (!args.opponentHasName) {
        if (!window.confirm("부전승 진출")) return;
      }
      const pairIndex = Math.floor(args.internalIndex / 2);
      const choice = (args.internalIndex % 2) as WinnerChoice;
      const pairKey = `${args.roundIndex}:${pairIndex}`;
      setWinnerByPair((prev) => {
        const next: Record<string, WinnerChoice> = { ...prev, [pairKey]: choice };
        for (const key of Object.keys(next)) {
          const [roundRaw, pairRaw] = key.split(":");
          const round = Number(roundRaw);
          const pair = Number(pairRaw);
          if (!Number.isFinite(round) || !Number.isFinite(pair)) continue;
          if (round <= args.roundIndex) continue;
          const shift = 2 ** (round - args.roundIndex);
          const affectedPair = Math.floor(pairIndex / shift);
          if (pair === affectedPair) {
            delete next[key];
          }
        }
        return next;
      });
      setSelectedBoxKey(`${args.matchId}:${args.winnerUserId}`);
      void onPickWinner?.({ matchId: args.matchId, winnerUserId: pickedUid, roundNumber: args.roundNumber });
    },
    [bracket, interactionDisabled, onPickWinner],
  );

  const handleAdvanceCancel = useCallback(
    async (pairKey: string) => {
      const [roundRaw, pairRaw] = pairKey.split(":");
      const baseRound = Number(roundRaw);
      const basePair = Number(pairRaw);
      if (!Number.isFinite(baseRound) || !Number.isFinite(basePair)) return;

      const selected = winnerByPair[pairKey];
      const hasServerWinner = matchPairHasClearableServerWinner(bracket, baseRound, basePair);
      if (selected !== 0 && selected !== 1 && !hasServerWinner) return;
      if (!window.confirm("진출을 취소하시겠습니까?")) return;

      const item = activeLayout.positionedMatches.find(
        (p) => p.roundIndex === baseRound && Math.floor(p.internalIndex / 2) === basePair,
      );
      if (!item) return;

      if (onClearMatchWinner && hasServerWinner) {
        const ok = await onClearMatchWinner({ matchId: item.match.id });
        if (ok === false) return;
      }

      setWinnerByPair((prev) => cascadeClearWinnerByPairState(prev, pairKey, baseRound, basePair));
    },
    [activeLayout.positionedMatches, bracket, onClearMatchWinner, winnerByPair],
  );

  const onBoxPointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      args: {
        boxKey: string;
        matchId: string;
        slot: "player1" | "player2";
        roundNumber: number;
        roundIndex: number;
        internalIndex: number;
        playerName: string;
      },
    ) => {
      e.stopPropagation();
      boxPointerStartRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, ts: Date.now() });
      setSelectedBoxKey(args.boxKey);
      const allowRenameLongPress =
        Boolean(onRenamePlayer) &&
        !interactionDisabled &&
        !actionBusy &&
        (interactionMode === "editSwap" || (chromeMode === "bracketView" && interactionMode === "winner"));
      if (!allowRenameLongPress) return;
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        setRenameEditing({
          roundNumber: args.roundNumber,
          roundIndex: args.roundIndex,
          internalIndex: args.internalIndex,
          matchId: args.matchId,
          slot: args.slot,
          value: args.playerName,
        });
      }, RENAME_LONG_PRESS_MS);
    },
    [actionBusy, chromeMode, interactionDisabled, interactionMode, onRenamePlayer],
  );

  const onBoxPointerMoveForLongPress = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const s = boxPointerStartRef.current.get(e.pointerId);
    if (!s) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const onBoxPointerUp = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      boxKey: string,
      matchId: string,
      slot: "player1" | "player2",
      winnerUserId: string,
      roundNumber: number,
      roundIndex: number,
      internalIndex: number,
      slotLabel: string,
      opponentHasName: boolean,
    ) => {
      e.stopPropagation();
      const s = boxPointerStartRef.current.get(e.pointerId);
      boxPointerStartRef.current.delete(e.pointerId);
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!s || interactionDisabled) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const moved = Math.hypot(dx, dy);
      const elapsed = Date.now() - s.ts;
      if (moved > 10 || elapsed > 350) return;

      const now = Date.now();
      const isDoubleTap = lastTapRef.current.key === boxKey && now - lastTapRef.current.ts <= 280;
      lastTapRef.current = { key: boxKey, ts: now };
      if (interactionMode === "winner" && isDoubleTap) {
        if (!slotLabel.trim()) return;
        if (!isEligibleBracketWinnerUserId(winnerUserId)) return;
        handleWinnerPick({
          matchId,
          winnerUserId,
          roundNumber,
          roundIndex,
          internalIndex,
          opponentHasName,
        });
        return;
      }
      if (interactionMode === "editSwap") {
        if (actionBusy) return;
        setSwapCandidate((prev) => {
          if (!prev) {
            return {
              key: boxKey,
              roundNumber,
              matchId,
              slot,
            };
          }
          if (prev.key === boxKey) return null;
          if (prev.roundNumber !== roundNumber) {
            setSelectedBoxKey("");
            return null;
          }
          void onSwapPlayers?.({
            roundNumber,
            first: { matchId: prev.matchId, slot: prev.slot },
            second: { matchId, slot },
          });
          return null;
        });
      }
    },
    [actionBusy, handleWinnerPick, interactionDisabled, interactionMode, onSwapPlayers],
  );

  const currentRoundNumber = useMemo(() => {
    if (swapCandidate) return swapCandidate.roundNumber;
    if (!selectedBoxKey) return null;
    const [matchId] = selectedBoxKey.split(":");
    for (const item of activeLayout.positionedMatches) {
      if (item.match.id === matchId) return item.roundNumber;
    }
    return null;
  }, [activeLayout.positionedMatches, selectedBoxKey, swapCandidate]);

  const roundStrengthLabel = useMemo(() => {
    const firstRoundMatches = bracket.rounds[0]?.matches.length ?? 0;
    const slots = firstRoundMatches > 0 ? firstRoundMatches * 2 : 0;
    return slots > 0 ? `${slots}강전` : "";
  }, [bracket.rounds]);
  const tournamentInfoLine1 = `${(tournamentTitle || "").trim()}${roundStrengthLabel ? ` ${roundStrengthLabel}` : ""}`.trim();
  const tournamentInfoLine2 = `${formatDateWithKoreanDow(tournamentDate)} ${stripVenueAddress(tournamentLocation)}`.trim();

  const isConnectorSegmentActive = useCallback(
    (connectorKey: string, segmentIndex: number): boolean => {
      if (!connectorKey.includes("+")) {
        return derived.activeConnectorKeys.has(connectorKey);
      }
      const [leftPart, rightPart] = connectorKey.split("+");
      const [rightSlotPart, parentPart] = (rightPart ?? "").split("->");
      if (!leftPart || !rightSlotPart || !parentPart) return false;
      if (segmentIndex === 0) return derived.activeConnectorKeys.has(`pair:${leftPart}`);
      if (segmentIndex === 1) return derived.activeConnectorKeys.has(`pair:${rightSlotPart}`);
      return derived.activeConnectorKeys.has(`${leftPart}+${rightSlotPart}->${parentPart}`);
    },
    [derived.activeConnectorKeys],
  );

  const pairKeyFromConnector = useCallback((connectorKey: string): string | null => {
    if (connectorKey.includes("+")) {
      const [leftPart] = connectorKey.split("+");
      const [roundRaw, slotRaw] = (leftPart ?? "").split(":");
      const roundNo = Number(roundRaw);
      const slot = Number(slotRaw);
      if (!Number.isFinite(roundNo) || !Number.isFinite(slot)) return null;
      return `${roundNo - 1}:${Math.floor(slot / 2)}`;
    }
    const [leftPart] = connectorKey.split("->");
    const [roundRaw, slotRaw] = (leftPart ?? "").split(":");
    const roundNo = Number(roundRaw);
    const slot = Number(slotRaw);
    if (!Number.isFinite(roundNo) || !Number.isFinite(slot)) return null;
    return `${roundNo - 1}:${Math.floor(slot / 2)}`;
  }, []);

  const advanceCancelButtons = useMemo(() => {
    const byKey = new Map<string, (typeof activeLayout.positionedMatches)[number]>();
    for (const item of activeLayout.positionedMatches) {
      byKey.set(`${item.roundIndex + 1}:${item.internalIndex}`, item);
    }
    const buttons: Array<{ key: string; x: number; y: number; pairKey: string }> = [];
    for (const connector of activeLayout.connectors) {
      const pairKey = pairKeyFromConnector(connector.key);
      if (!pairKey) continue;
      const [pkR, pkP] = pairKey.split(":");
      const ri = Number(pkR);
      const pi = Number(pkP);
      const showCancel =
        pairKey in winnerByPair ||
        (Number.isFinite(ri) && Number.isFinite(pi) && matchPairHasClearableServerWinner(bracket, ri, pi));
      if (!showCancel) continue;
      const [leftPart, rightRaw] = connector.key.split("+");
      if (!rightRaw) continue;
      const [, parentPart] = rightRaw.split("->");
      if (!leftPart || !parentPart) continue;
      const left = byKey.get(leftPart);
      const parent = byKey.get(parentPart);
      if (!left || !parent) continue;
      let x: number;
      let y: number;
      if (viewMode === "vertical") {
        x = parent.frame.x + parent.frame.width / 2 + 11;
        y = (left.frame.y + parent.frame.y + parent.frame.height) / 2;
      } else {
        const parentRight = parent.frame.x + parent.frame.width;
        const midX = (left.frame.x + left.frame.width + parent.frame.x) / 2;
        const cyL = left.frame.y + left.frame.height / 2;
        const cyP = parent.frame.y + parent.frame.height / 2;
        if (parent.frame.x >= left.frame.x + left.frame.width - 1) {
          x = midX;
          y = (cyL + cyP) / 2;
        } else {
          const midX2 = (left.frame.x + parentRight) / 2;
          x = midX2;
          y = (cyL + cyP) / 2;
        }
      }
      buttons.push({ key: `${pairKey}:${connector.key}`, x, y, pairKey });
    }
    return buttons;
  }, [
    activeLayout.connectors,
    activeLayout.positionedMatches,
    bracket,
    pairKeyFromConnector,
    viewMode,
    winnerByPair,
  ]);

  const rootChrome =
    chromeMode === "bracketView"
      ? ` ${styles.boardChromeBracketView}`
      : "";

  const collapseMobileToolbar =
    chromeMode === "bracketView" && isMobileBracketViewLayout && !mobileToolbarExpanded;

  return (
    <section
      className={
        (viewMode === "vertical"
          ? `${styles.boardRoot} ${styles.boardRootVerticalMatch}`
          : `${styles.boardRoot} ${styles.boardRootHorizontalSlot}`) + rootChrome
      }
      data-interactive-bracket-root="1"
    >
      <div className={styles.controlBar}>
        {!interactionDisabled ? (
          <button
            data-board-control
            type="button"
            className={styles.controlBtn}
            disabled={!canUndo || actionBusy}
            onClick={() => {
              void onUndo?.();
            }}
          >
            되돌리기
          </button>
        ) : null}
        {!interactionDisabled ? (
          <button
            data-board-control
            type="button"
            className={`${styles.controlBtn} ${interactionMode === "winner" ? styles.controlBtnActive : ""}`}
            onClick={() => {
              setInteractionMode("winner");
              setSwapCandidate(null);
              setRenameEditing(null);
            }}
          >
            승자 선택
          </button>
        ) : null}
        {!interactionDisabled ? (
          <button
            data-board-control
            type="button"
            className={`${styles.controlBtn} ${interactionMode === "editSwap" ? styles.controlBtnActive : ""}`}
            onClick={() => setInteractionMode("editSwap")}
            disabled={actionBusy}
          >
            편집/스왑
          </button>
        ) : null}
        {!interactionDisabled && !shuffleRoundHidden ? (
          <button
            data-board-control
            type="button"
            className={styles.controlBtn}
            disabled={actionBusy || interactionMode !== "editSwap" || currentRoundNumber === null}
            onClick={() => {
              if (currentRoundNumber === null) return;
              void onShuffleRound?.(currentRoundNumber);
            }}
          >
            다시 섞기
          </button>
        ) : null}
        <span className={styles.scaleLabel}>
          {chromeMode === "bracketView" && connectivityHint.trim()
            ? `${connectivityHint.trim()} · `
            : ""}
          {saveStateText ? `${saveStateText} · ` : ""}
          {canvasWidth}×{canvasHeight} · {(scale * 100).toFixed(0)}%
        </span>
      </div>

      {tournamentInfoLine1 || tournamentInfoLine2 ? (
        <aside className={styles.tournamentOverlay} aria-label="대회 정보">
          {tournamentInfoLine1 ? <p className={styles.tournamentTitle}>{tournamentInfoLine1}</p> : null}
          {tournamentInfoLine2 ? <p className={styles.tournamentMeta}>{tournamentInfoLine2}</p> : null}
        </aside>
      ) : null}

      <div
        className={styles.bracketFloatingToolbar}
        data-bracket-toolbar="1"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {collapseMobileToolbar ? (
          <div
            className={`${styles.bracketFloatingToolbarInner} ${styles.bracketViewToolbarIcons} ${styles.bracketToolbarCollapsedWrap}`}
          >
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarMenuToggle}`}
              title="메뉴 펼치기"
              aria-label="메뉴 펼치기"
              aria-expanded={false}
              onClick={() => setMobileToolbarExpanded(true)}
            >
              ≡
            </button>
          </div>
        ) : (
          <div
            className={
              chromeMode === "bracketView"
                ? `${styles.bracketFloatingToolbarInner} ${styles.bracketViewToolbarIcons}`
                : styles.bracketFloatingToolbarInner
            }
          >
            {chromeMode === "bracketView" ? (
              <>
                <button
                  type="button"
                  className={`${styles.toolbarButton} ${styles.toolbarBracketViewWideBtn} ${styles.toolbarBracketViewGlyphBtn}`}
                  title={toolbarLayoutIsLandscape ? "기기 세로모드" : "기기 가로모드"}
                  aria-label={toolbarLayoutIsLandscape ? "기기 세로모드" : "기기 가로모드"}
                  onClick={() =>
                    toolbarLayoutIsLandscape
                      ? (unregisterCaromExplicitNativeLandscapeSession(CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID),
                        applyCaromOrientationMode("portrait", "bracket-view-fullscreen:toolbar-portrait"))
                      : (registerCaromExplicitNativeLandscapeSession(CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID),
                        applyCaromOrientationMode("landscape", "bracket-view-fullscreen:toolbar-landscape"))
                  }
                >
                  {toolbarLayoutIsLandscape ? (
                    <BracketToolbarPhonePortraitGlyph className={styles.bracketToolbarPhoneSvg} />
                  ) : (
                    <BracketToolbarPhoneLandscapeGlyph className={styles.bracketToolbarPhoneSvg} />
                  )}
                </button>
                <hr className={styles.toolbarDivider} aria-hidden />
              </>
            ) : null}
            {chromeMode === "bracketView" && onExit ? (
              <button
                type="button"
                className={`${styles.toolbarButton} ${styles.toolbarExitBracketView}`}
                title="나가기"
                aria-label="나가기"
                onClick={() => onExit()}
              >
                ←
              </button>
            ) : null}
            {chromeMode === "bracketView" && bracketViewSlicePicker ? (
              <button
                type="button"
                className={`${styles.toolbarButton} ${styles.toolbarBracketViewWideBtn} ${styles.toolbarBracketViewGlyphBtn}`}
                title="조 선택"
                aria-label="조 선택"
                onClick={() => setBracketViewModal("slice")}
              >
                ▦
              </button>
            ) : null}
            {chromeMode === "bracketView" && bracketViewZones ? (
              <button
                type="button"
                className={`${styles.toolbarButton} ${styles.toolbarBracketViewWideBtn}`}
                title="권역 선택"
                aria-label="권역 선택"
                onClick={() => setBracketViewModal("zone")}
              >
                권역
              </button>
            ) : null}
            {chromeMode === "bracketView" && (bracketViewSlicePicker || bracketViewZones) ? (
              <hr className={styles.toolbarDivider} aria-hidden />
            ) : null}
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarOrientationWide} ${
                viewMode === "vertical" ? styles.toolbarButtonActive : ""
              }`}
              title="세로형 보기"
              aria-label="세로형 보기"
              onClick={() => setViewMode("vertical")}
            >
              {chromeMode === "bracketView" ? (
                <span className={styles.toolbarBtnLabelShort}>┴</span>
              ) : (
                <>
                  <span className={styles.toolbarBtnLabelShort}>V</span>
                  <span className={styles.toolbarBtnLabelLong}>세로</span>
                </>
              )}
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarOrientationWide} ${
                viewMode === "horizontal" ? styles.toolbarButtonActive : ""
              }`}
              title="가로형 보기"
              aria-label="가로형 보기"
              onClick={() => setViewMode("horizontal")}
            >
              {chromeMode === "bracketView" ? (
                <span className={styles.toolbarBtnLabelShort}>├</span>
              ) : (
                <>
                  <span className={styles.toolbarBtnLabelShort}>H</span>
                  <span className={styles.toolbarBtnLabelLong}>가로</span>
                </>
              )}
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarDualDesktopOnly} ${
                viewMode === "dual" ? styles.toolbarButtonActive : ""
              }`}
              title="양쪽형 보기"
              aria-label="양쪽형 보기"
              onClick={() => setViewMode("dual")}
            >
              {chromeMode === "bracketView" ? (
                <span className={styles.toolbarBtnLabelShort}>H</span>
              ) : (
                "⇄"
              )}
            </button>
            <hr className={styles.toolbarDivider} aria-hidden />
            <button
              type="button"
              className={styles.toolbarButton}
              title="확대"
              aria-label="확대"
              onClick={() => zoomFromViewportCenter(1.2)}
            >
              +
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              title="축소"
              aria-label="축소"
              onClick={() => zoomFromViewportCenter(1 / 1.2)}
            >
              −
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              title="전체보기"
              aria-label="전체보기"
              onClick={() => fitBracketToViewport()}
            >
              □
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${styles.toolbarResetDesktopOnly}`}
              title="초기화"
              aria-label="초기화"
              onClick={() => resetBracketView()}
            >
              ↺
            </button>
            {chromeMode === "bracketView" && isMobileBracketViewLayout ? (
              <button
                type="button"
                className={`${styles.toolbarButton} ${styles.toolbarMenuToggle}`}
                title="메뉴 접기"
                aria-label="메뉴 접기"
                aria-expanded
                onClick={() => setMobileToolbarExpanded(false)}
              >
                ≡
              </button>
            ) : null}
          </div>
        )}
      </div>

      {chromeMode === "bracketView" && bracketViewNotice.trim() ? (
        <div className={styles.bracketViewNoticeBar} role="status">
          {bracketViewNotice}
        </div>
      ) : null}

      {chromeMode === "bracketView" && bracketViewModal === "slice" && bracketViewSlicePicker ? (
        <div
          className={styles.bracketViewModalBackdrop}
          role="presentation"
          onClick={() => setBracketViewModal(null)}
        >
          <div
            className={styles.bracketViewModalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bracket-view-slice-modal-title"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p id="bracket-view-slice-modal-title" className={styles.bracketViewModalTitle}>
              조 선택
            </p>
            <div className={styles.bracketViewModalActions}>
              {bracketViewSlicePicker.blocks.map((bl) => {
                const key = `block:${bl.id}`;
                const active = bracketViewSlicePicker.boardSliceKey === key;
                return (
                  <button
                    key={bl.id}
                    type="button"
                    className={`${styles.bracketViewModalBtn} ${active ? styles.bracketViewModalBtnActive : ""}`}
                    onClick={() => {
                      bracketViewSlicePicker.onSliceChange(key);
                      setBracketViewModal(null);
                    }}
                  >
                    조 {bl.label ?? bl.id}
                  </button>
                );
              })}
              {bracketViewSlicePicker.hasFinal ? (
                <button
                  type="button"
                  className={`${styles.bracketViewModalBtn} ${
                    bracketViewSlicePicker.boardSliceKey === "final" ? styles.bracketViewModalBtnActive : ""
                  }`}
                  onClick={() => {
                    bracketViewSlicePicker.onSliceChange("final");
                    setBracketViewModal(null);
                  }}
                >
                  결선
                </button>
              ) : null}
            </div>
            <button type="button" className={styles.bracketViewModalDismiss} onClick={() => setBracketViewModal(null)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {chromeMode === "bracketView" && bracketViewModal === "zone" && bracketViewZones ? (
        <div
          className={styles.bracketViewModalBackdrop}
          role="presentation"
          onClick={() => setBracketViewModal(null)}
        >
          <div
            className={styles.bracketViewModalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bracket-view-zone-modal-title"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p id="bracket-view-zone-modal-title" className={styles.bracketViewModalTitle}>
              권역 선택
            </p>
            <div className={styles.bracketViewModalActions}>
              {bracketViewZones.options.length === 0 ? (
                <p className={styles.bracketViewModalEmpty}>등록된 권역이 없습니다.</p>
              ) : (
                bracketViewZones.options.map((z) => {
                  const active = bracketViewZones.selectedId === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      className={`${styles.bracketViewModalBtn} ${active ? styles.bracketViewModalBtnActive : ""}`}
                      onClick={() => {
                        bracketViewZones.onChange(z.id);
                        setBracketViewModal(null);
                      }}
                    >
                      {z.zoneName}
                    </button>
                  );
                })
              )}
            </div>
            <button type="button" className={styles.bracketViewModalDismiss} onClick={() => setBracketViewModal(null)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className={`${styles.viewport} ${isPanning ? styles.viewportPanning : styles.viewportGrab}`}
        onWheel={handleViewportWheel}
        onPointerDownCapture={onViewportPointerDown}
        onPointerMoveCapture={onViewportPointerMove}
        onPointerUpCapture={onViewportPointerEnd}
        onPointerCancelCapture={onViewportPointerEnd}
      >
        <div
          className={styles.zoomLayer}
          style={{
            boxSizing: "border-box",
            width: `${canvasWidth * scale + viewportSize.width}px`,
            height: `${canvasHeight * scale + viewportSize.height}px`,
            paddingLeft: `${viewportSize.width / 2}px`,
            paddingRight: `${viewportSize.width / 2}px`,
            paddingTop: `${viewportSize.height / 2}px`,
            paddingBottom: `${viewportSize.height / 2}px`,
          }}
        >
          <div
            style={{
              width: `${canvasWidth * scale}px`,
              height: `${canvasHeight * scale}px`,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              className={styles.canvas}
              style={{
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <div className={styles.content}>
              <svg className={styles.linkSvg} width={canvasWidth} height={canvasHeight}>
                {activeLayout.connectors.map((connector) => (
                  <g key={connector.key}>
                    {connector.basePaths.map((d, idx) => {
                      const active = isConnectorSegmentActive(connector.key, idx);
                      return (
                        <path
                          key={`${connector.key}:${idx}`}
                          d={d}
                          className={`${styles.pathBase} ${active ? styles.pathActive : ""} ${active ? "board-path-winner" : ""}`}
                          style={{ pointerEvents: "none" }}
                        />
                      );
                    })}
                  </g>
                ))}
              </svg>
              {advanceCancelButtons.map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  className={styles.advanceCancelButton}
                  style={{ left: `${btn.x}px`, top: `${btn.y}px` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleAdvanceCancel(btn.pairKey);
                  }}
                  title="진출 취소"
                >
                  ×
                </button>
              ))}

              {activeLayout.positionedMatches.map((item) => {
                const slotWinner = derived.winnerByItemKey.get(item.key) === true;
                const slotLoser = derived.loserByItemKey.get(item.key) === true;
                const rawSlot = readRawSlotPlayer(bracket, item.roundIndex, item.internalIndex);
                const highlightUid = slotUserIdForHighlight(rawSlot);
                const pickUserIdForApi = highlightUid && rawSlot ? rawSlot.userId.trim() : "";
                const boxKey = `${item.match.id}:${item.internalIndex}`;
                const slotLabel = derived.labelByItemKey.get(item.key) ?? "";
                const slotHasName = slotLabel.trim() !== "";
                const opponentHasName = derived.opponentHasNameByItemKey.get(item.key) === true;
                const playerSlot: "player1" | "player2" = item.internalIndex % 2 === 0 ? "player1" : "player2";
                const origName = (rawSlot?.name ?? "").trim();
                const dispName = (rawSlot?.displayName ?? "").trim();
                const showRenameBadge = dispName.length > 0 && dispName !== origName;
                const hasStoredDisplayName = dispName.length > 0;
                const useDisplayNameStyle = showRenameBadge;
                const editing = renameEditing;
                const isRenamingThis =
                  editing !== null && editing.matchId === item.match.id && editing.slot === playerSlot;
                return (
                  <div
                    key={item.key}
                    className={styles.matchGroup}
                    style={{
                      left: `${item.frame.x}px`,
                      top: `${item.frame.y}px`,
                      width: `${item.frame.width}px`,
                    }}
                  >
                    <div
                      className={[
                        styles.playerBox,
                        selectedBoxKey === boxKey ? styles.playerSelected : "",
                        swapCandidate?.key === boxKey ? styles.playerSwapCandidate : "",
                        slotHasName && !slotLoser ? styles.playerHasName : "",
                        slotWinner && !slotLoser ? styles.playerWinner : "",
                        slotLoser ? styles.playerLoser : "",
                        slotWinner && !slotLoser ? "board-player-winner" : "",
                        slotLoser ? "board-player-loser" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-player-box="1"
                      style={{ width: `${item.frame.width}px`, height: `${item.frame.height}px` }}
                      title={slotLabel || undefined}
                      onPointerDown={(e) =>
                        onBoxPointerDown(e, {
                          boxKey,
                          matchId: item.match.id,
                          slot: playerSlot,
                          roundNumber: item.roundNumber,
                          roundIndex: item.roundIndex,
                          internalIndex: item.internalIndex,
                          playerName: slotLabel,
                        })
                      }
                      onPointerMove={onBoxPointerMoveForLongPress}
                      onPointerUp={(e) =>
                        onBoxPointerUp(
                          e,
                          boxKey,
                          item.match.id,
                          playerSlot,
                          pickUserIdForApi,
                          item.roundNumber,
                          item.roundIndex,
                          item.internalIndex,
                          slotLabel,
                          opponentHasName,
                        )
                      }
                      onDoubleClick={() =>
                        interactionMode === "winner"
                          ? slotHasName && pickUserIdForApi
                            ? handleWinnerPick({
                                matchId: item.match.id,
                                winnerUserId: pickUserIdForApi,
                                roundNumber: item.roundNumber,
                                roundIndex: item.roundIndex,
                                internalIndex: item.internalIndex,
                                opponentHasName,
                              })
                            : undefined
                          : setRenameEditing({
                              roundNumber: item.roundNumber,
                              roundIndex: item.roundIndex,
                              internalIndex: item.internalIndex,
                              matchId: item.match.id,
                              slot: playerSlot,
                              value: slotLabel,
                            })
                      }
                    >
                      {showRenameBadge && !isRenamingThis ? (
                        <span className={styles.playerEditBadge} aria-hidden>
                          ✎
                        </span>
                      ) : null}
                      {isRenamingThis && editing ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            justifyContent: "center",
                            width: "100%",
                            height: "100%",
                            minHeight: 0,
                          }}
                        >
                          <input
                            autoFocus
                            value={editing.value}
                            className={styles.playerInlineInput}
                            onChange={(ev) =>
                              setRenameEditing((prev) => (prev ? { ...prev, value: ev.target.value } : prev))
                            }
                            onBlur={() => {
                              const payload = editing;
                              setRenameEditing(null);
                              if (!payload) return;
                              const rawPlayer = readRawSlotPlayer(bracket, payload.roundIndex, payload.internalIndex);
                              const next = payload.value.trim();
                              const resolved = resolveRenameDisplayPayload(rawPlayer, slotLabel, next);
                              if (resolved === null) return;
                              void onRenamePlayer?.({
                                roundNumber: payload.roundNumber,
                                matchId: payload.matchId,
                                slot: payload.slot,
                                displayName: resolved,
                              });
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key === "Escape") {
                                setRenameEditing(null);
                                return;
                              }
                              if (ev.key !== "Enter") return;
                              const payload = editing;
                              setRenameEditing(null);
                              if (!payload) return;
                              const rawPlayer = readRawSlotPlayer(bracket, payload.roundIndex, payload.internalIndex);
                              const next = payload.value.trim();
                              const resolved = resolveRenameDisplayPayload(rawPlayer, slotLabel, next);
                              if (resolved === null) return;
                              void onRenamePlayer?.({
                                roundNumber: payload.roundNumber,
                                matchId: payload.matchId,
                                slot: payload.slot,
                                displayName: resolved,
                              });
                            }}
                          />
                          {hasStoredDisplayName ? (
                            <button
                              type="button"
                              style={{
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                padding: "2px 4px",
                                borderRadius: 4,
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                color: "#334155",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setRenameEditing(null);
                                void onRenamePlayer?.({
                                  roundNumber: item.roundNumber,
                                  matchId: item.match.id,
                                  slot: playerSlot,
                                  displayName: "",
                                });
                              }}
                            >
                              원래 이름으로 되돌리기
                            </button>
                          ) : null}
                        </div>
                      ) : useDisplayNameStyle ? (
                        <span className={styles.playerDisplayNameOverride}>{slotLabel}</span>
                      ) : (
                        slotLabel
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
