"use client";

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type BoardRound = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: BoardMatch[];
};

type BracketBoardInput = {
  id: string;
  rounds: BoardRound[];
};

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
  onSwapPlayers,
  onRenamePlayer,
  onShuffleRound,
  interactionDisabled = false,
  actionBusy = false,
  canUndo = false,
  onUndo,
  saveStateText = "",
}: {
  bracket: BracketBoardInput;
  tournamentTitle?: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  onPickWinner?: (args: { matchId: string; winnerUserId: string; roundNumber: number }) => void | Promise<void>;
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
    matchId: string;
    slot: "player1" | "player2";
    value: string;
  } | null>(null);
  const [winnerByPair, setWinnerByPair] = useState<Record<string, WinnerChoice>>({});
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const longPressTimerRef = useRef<number | null>(null);
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
  const metrics = useMemo<BracketBoardMetrics>(
    () => computeBracketBoardMetrics(bracket as BoardBracket, "vertical"),
    [bracket],
  );

  const layoutVerticalBase = useMemo(
    () => calculateLayout(bracket as BoardBracket, metrics, "vertical"),
    [bracket, metrics],
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
    scrollViewportToDefault();
  }, [scrollViewportToDefault, canvasWidth, canvasHeight, bracket, viewMode]);

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
        const chosenLabel = choice === 0 ? a : b;
        if (!chosenLabel.trim()) continue;
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
      const parentLabels = labelsByRound[r + 1];
      for (let s = 0; s < row.length; s += 1) {
        const item = row[s];
        if (!item) continue;
        const label = labels[s] ?? "";
        labelByItemKey.set(item.key, label);
        const pairIdx = Math.floor(s / 2);
        const pairBase = pairIdx * 2;
        const selfInPair = s % 2;
        const oppIdx = pairBase + (selfInPair === 0 ? 1 : 0);
        const selfName = (labels[s] ?? "").trim();
        const opponentName = (labels[oppIdx] ?? "").trim();
        const nextRoundName = parentLabels ? (parentLabels[pairIdx] ?? "").trim() : "";
        const isWinner = Boolean(selfName && nextRoundName && nextRoundName === selfName);
        const isLoser = Boolean(selfName && opponentName && nextRoundName && nextRoundName === opponentName);
        opponentHasNameByItemKey.set(item.key, opponentName !== "");
        winnerByItemKey.set(item.key, isWinner);
        loserByItemKey.set(item.key, isLoser);
      }
    }

    return { labelByItemKey, winnerByItemKey, loserByItemKey, opponentHasNameByItemKey, activeConnectorKeys, chosenByPair };
  }, [activeLayout.positionedMatches, winnerByPair]);

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
      void onPickWinner?.({ matchId: args.matchId, winnerUserId: args.winnerUserId, roundNumber: args.roundNumber });
    },
    [interactionDisabled, onPickWinner],
  );

  const handleAdvanceCancel = useCallback((pairKey: string) => {
    const selected = winnerByPair[pairKey];
    if (selected !== 0 && selected !== 1) return;
    if (!window.confirm("진출을 취소하시겠습니까?")) return;
    const [roundRaw, pairRaw] = pairKey.split(":");
    const baseRound = Number(roundRaw);
    const basePair = Number(pairRaw);
    if (!Number.isFinite(baseRound) || !Number.isFinite(basePair)) return;
    setWinnerByPair((prev) => {
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
    });
  }, [winnerByPair]);

  const onBoxPointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      args: {
        boxKey: string;
        matchId: string;
        slot: "player1" | "player2";
        roundNumber: number;
        playerName: string;
      },
    ) => {
      e.stopPropagation();
      boxPointerStartRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, ts: Date.now() });
      setSelectedBoxKey(args.boxKey);
      if (interactionMode === "editSwap" && !interactionDisabled && !actionBusy) {
        if (longPressTimerRef.current !== null) {
          window.clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = window.setTimeout(() => {
          setRenameEditing({
            roundNumber: args.roundNumber,
            matchId: args.matchId,
            slot: args.slot,
            value: args.playerName,
          });
        }, 560);
      }
    },
    [actionBusy, interactionDisabled, interactionMode],
  );

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
      if (!(pairKey in winnerByPair)) continue;
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
    pairKeyFromConnector,
    viewMode,
    winnerByPair,
  ]);

  return (
    <section
      className={
        viewMode === "vertical"
          ? `${styles.boardRoot} ${styles.boardRootVerticalMatch}`
          : `${styles.boardRoot} ${styles.boardRootHorizontalSlot}`
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
        {!interactionDisabled ? (
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
            현재 라운드 재배치
          </button>
        ) : null}
        <span className={styles.scaleLabel}>
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
        <div className={styles.bracketFloatingToolbarInner}>
          <button
            type="button"
            className={`${styles.toolbarButton} ${viewMode === "vertical" ? styles.toolbarButtonActive : ""}`}
            title="세로형 보기"
            aria-label="세로형 보기"
            onClick={() => setViewMode("vertical")}
          >
            V
          </button>
          <button
            type="button"
            className={`${styles.toolbarButton} ${viewMode === "horizontal" ? styles.toolbarButtonActive : ""}`}
            title="가로형 보기"
            aria-label="가로형 보기"
            onClick={() => setViewMode("horizontal")}
          >
            H
          </button>
          <button
            type="button"
            className={`${styles.toolbarButton} ${viewMode === "dual" ? styles.toolbarButtonActive : ""}`}
            title="양쪽형 보기"
            aria-label="양쪽형 보기"
            onClick={() => setViewMode("dual")}
          >
            ⇄
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
            className={styles.toolbarButton}
            title="초기화"
            aria-label="초기화"
            onClick={() => resetBracketView()}
          >
            ↺
          </button>
        </div>
      </div>

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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvanceCancel(btn.pairKey);
                  }}
                  title="진출 취소"
                >
                  ×
                </button>
              ))}

              {activeLayout.positionedMatches.map((item) => {
                const slotWinner = derived.winnerByItemKey.get(item.key) === true;
                const slotLoser = derived.loserByItemKey.get(item.key) === true;
                const boxKey = `${item.match.id}:${item.match.player1.userId}`;
                const slotLabel = derived.labelByItemKey.get(item.key) ?? "";
                const slotHasName = slotLabel.trim() !== "";
                const opponentHasName = derived.opponentHasNameByItemKey.get(item.key) === true;
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
                          slot: "player1",
                          roundNumber: item.roundNumber,
                          playerName: slotLabel,
                        })
                      }
                      onPointerUp={(e) =>
                        onBoxPointerUp(
                          e,
                          boxKey,
                          item.match.id,
                          "player1",
                          item.match.player1.userId,
                          item.roundNumber,
                          item.roundIndex,
                          item.internalIndex,
                          slotLabel,
                          opponentHasName,
                        )
                      }
                      onDoubleClick={() =>
                        interactionMode === "winner"
                          ? slotHasName
                            ? handleWinnerPick({
                                matchId: item.match.id,
                                winnerUserId: item.match.player1.userId,
                                roundNumber: item.roundNumber,
                                roundIndex: item.roundIndex,
                                internalIndex: item.internalIndex,
                                opponentHasName,
                              })
                            : undefined
                          : setRenameEditing({
                              roundNumber: item.roundNumber,
                              matchId: item.match.id,
                              slot: "player1",
                              value: slotLabel,
                            })
                      }
                    >
                      {renameEditing &&
                      renameEditing.matchId === item.match.id &&
                      renameEditing.slot === "player1" ? (
                        <input
                          autoFocus
                          value={renameEditing.value}
                          className={styles.playerInlineInput}
                          onChange={(ev) => setRenameEditing((prev) => (prev ? { ...prev, value: ev.target.value } : prev))}
                          onBlur={() => {
                            const payload = renameEditing;
                            setRenameEditing(null);
                            if (!payload) return;
                            const next = payload.value.trim();
                            if (!next || next === slotLabel) return;
                            void onRenamePlayer?.({
                              roundNumber: payload.roundNumber,
                              matchId: payload.matchId,
                              slot: payload.slot,
                              displayName: next,
                            });
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Escape") {
                              setRenameEditing(null);
                              return;
                            }
                            if (ev.key !== "Enter") return;
                            const payload = renameEditing;
                            setRenameEditing(null);
                            if (!payload) return;
                            const next = payload.value.trim();
                            if (!next || next === slotLabel) return;
                            void onRenamePlayer?.({
                              roundNumber: payload.roundNumber,
                              matchId: payload.matchId,
                              slot: payload.slot,
                              displayName: next,
                            });
                          }}
                        />
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
