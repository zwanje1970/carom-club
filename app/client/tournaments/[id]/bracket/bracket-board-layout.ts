export type BoardPlayer = {
  userId: string;
  name: string;
};

export type BoardMatch = {
  id: string;
  player1: BoardPlayer;
  player2: BoardPlayer;
  winnerUserId: string | null;
  winnerName: string | null;
  status: "PENDING" | "COMPLETED";
};

export type BoardRound = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: BoardMatch[];
};

export type BoardBracket = {
  rounds: BoardRound[];
};

export type BracketLayoutType = "vertical" | "horizontal" | "center";

export type BracketBoardMetrics = {
  roundsCount: number;
  firstRoundMatches: number;
  participantCount: number;
  boxWidth: number;
  boxHeight: number;
  boxInnerGap: number;
  rowGap: number;
  roundGap: number;
  leftPadding: number;
  rightPadding: number;
  topPadding: number;
  bottomPadding: number;
  roundTitleHeight: number;
  columnPitch: number;
  basePitch: number;
  matchGroupWidth: number;
  matchGroupHeight: number;
  /** TREE_VERTICAL 1라운드 인접 경기 가로 간격(px) — 빈대진표 인쇄 277=240+37 분배와 동일 비율 */
  verticalMatchGap: number;
  /** 라운드 사이 선층에 해당하는 세로 간격(px) — 인쇄 lh/bh=0.8 */
  verticalRoundGap: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type MatchFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PositionedBoardMatch = {
  key: string;
  roundNumber: number;
  roundIndex: number;
  internalIndex: number;
  match: BoardMatch;
  frame: MatchFrame;
};

export type ConnectorGeometry = {
  key: string;
  basePaths: string[];
  winnerPath: string | null;
};

export type RoundTitleAnchor = {
  key: string;
  roundNumber: number;
  roundIndex: number;
  matchCount: number;
  x: number;
  /** Optional absolute Y (px) for round label; vertical bottom-up layout uses this */
  y?: number;
};

export type BracketLayoutCalculation = {
  positionedMatches: PositionedBoardMatch[];
  roundTitles: RoundTitleAnchor[];
  connectors: ConnectorGeometry[];
  /** vertical 트리: 실제 콘텐츠에 맞춘 캔버스 크기(뷰포트 스크롤 영역). 없으면 metrics 캔버스 사용 */
  canvasBounds?: { width: number; height: number };
};

/**
 * 대진표 시각 기준: 32강(참가 32명·1라운드 16경기) Baseline — 빈대진표 인쇄(`bracket-render-engine` TREE_VERTICAL)와
 * 동일한 비율·밀도만 참고하고, 픽셀·DOM은 대회관리 UI에 맞게 별도 상수로 둔다.
 * 64·128·512강에서 박스·폰트는 축소하지 않으며 캔버스만 확장한다.
 */
const BOX_WIDTH = 40;
/** 한 슬롯 높이: 인쇄 32강(16조) 시 셀 세로 bh와 비슷한 세로형 비(박스 가로 대비 높이) */
const BOX_HEIGHT = 68;
const BOX_INNER_GAP = 8;
const ROW_GAP = 16;
const ROUND_GAP = 96;
/** 대회관리 화면용 세로 트리 라운드 간격 배율(박스 높이 기준) */
const VERTICAL_TREE_ROUND_GAP_BOX_RATIO = 0.65;
/** 인쇄: 가로 277mm = 박스폭합 240 + 간격합 37 — 1라운드 N조일 때 조당 간격 비율 */
const PRINT_BOX_SPAN_MM = 240;
const PRINT_GAP_SPAN_MM = 37;
const LEFT_PADDING = 40;
const RIGHT_PADDING = 40;
const TOP_PADDING = 56;
const BOTTOM_PADDING = 48;
const ROUND_TITLE_HEIGHT = 24;

/** 세로 트리: 실제 좌표 bbox + 최소 여백(연결선 stroke 여유) */
const VERTICAL_CANVAS_PAD = 14;
const VERTICAL_STROKE_PAD = 2;
/** 라운드 라벨 bbox (텍스트 대략 영역, 과도한 빈 캔버스 방지용) */
const ROUND_TITLE_BBOX_W = 220;
const ROUND_TITLE_BBOX_H = 22;

function verticalInterRoundGapPx(boxHeight: number): number {
  return Math.round(boxHeight * VERTICAL_TREE_ROUND_GAP_BOX_RATIO);
}

/** 1라운드 박스 피치 = boxW + gap, gap은 인쇄식 (N·bw + (N-1)·gw = 240+37 스케일) */
function verticalFirstRoundHorizontalGapPx(boxWidth: number, firstRoundMatchCount: number): number {
  const n = Math.max(1, firstRoundMatchCount);
  if (n <= 1) return 0;
  const byPrintRatio = Math.round((boxWidth * n * PRINT_GAP_SPAN_MM) / (PRINT_BOX_SPAN_MM * (n - 1)));
  const byCompactGroup = Math.round(boxWidth * 0.45);
  return Math.max(byPrintRatio, byCompactGroup);
}

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

function placeholderMatch(roundNumber: number, internalIndex: number): BoardMatch {
  const uid1 = `__slot-${roundNumber}-${internalIndex}-1`;
  const uid2 = `__slot-${roundNumber}-${internalIndex}-2`;
  return {
    id: `__placeholder-${roundNumber}-${internalIndex}`,
    player1: { userId: uid1, name: "대기" },
    player2: { userId: uid2, name: "대기" },
    winnerUserId: null,
    winnerName: null,
    status: "PENDING",
  };
}

/** Full single-elimination rounds for display: pad missing upper rounds with placeholder matches */
function expandBracketRoundsForTree(bracket: BoardBracket): BoardRound[] {
  const sorted = [...(bracket.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
  const firstRoundMatches = safePositiveInt(sorted[0]?.matches?.length ?? 0);
  if (firstRoundMatches <= 0) return [];

  const roundsCount = inferRoundsCount(firstRoundMatches, sorted.length);
  const byRoundNumber = new Map<number, BoardRound>();
  for (const r of sorted) {
    byRoundNumber.set(r.roundNumber, r);
  }

  const out: BoardRound[] = [];
  for (let i = 0; i < roundsCount; i += 1) {
    const roundNumber = i + 1;
    const expectedMatches = Math.max(1, Math.floor(firstRoundMatches / 2 ** i));
    const existing = byRoundNumber.get(roundNumber);
    const merged: BoardMatch[] = [];
    for (let j = 0; j < expectedMatches; j += 1) {
      const real = existing?.matches[j];
      merged.push(real ?? placeholderMatch(roundNumber, j));
    }
    out.push({
      roundNumber,
      status: existing?.status ?? "PENDING",
      matches: merged,
    });
  }
  return out;
}

function safePositiveInt(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function inferRoundsCount(firstRoundMatches: number, actualRoundCount: number): number {
  const inferred = firstRoundMatches > 0 ? Math.max(1, Math.round(Math.log2(firstRoundMatches * 2))) : 1;
  return Math.max(inferred, safePositiveInt(actualRoundCount), 1);
}

export function computeBracketBoardMetrics(
  bracket: BoardBracket,
  layoutType: BracketLayoutType = "vertical",
): BracketBoardMetrics {
  const sortedRounds = [...(bracket.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
  const firstRoundMatches = safePositiveInt(sortedRounds[0]?.matches?.length ?? 0);
  const roundsCount = inferRoundsCount(firstRoundMatches, sortedRounds.length);
  const participantCount = Math.max(2, firstRoundMatches * 2);

  const columnPitch = BOX_WIDTH + ROUND_GAP;
  const basePitch = BOX_HEIGHT * 2 + BOX_INNER_GAP + ROW_GAP;
  const matchGroupWidth = BOX_WIDTH * 2 + BOX_INNER_GAP;
  const matchGroupHeight = BOX_HEIGHT;

  const maxFirstRoundMatches = Math.max(1, firstRoundMatches);
  const verticalMatchGap = verticalFirstRoundHorizontalGapPx(BOX_WIDTH, maxFirstRoundMatches);
  const verticalRoundGap = verticalInterRoundGapPx(BOX_HEIGHT);
  const sideRounds = Math.max(0, roundsCount - 1);
  const columns = layoutType === "center" ? sideRounds * 2 + 1 : roundsCount;
  const maxRows = layoutType === "center" ? Math.max(1, Math.ceil(maxFirstRoundMatches / 2)) : maxFirstRoundMatches;

  let canvasWidth: number;
  let canvasHeight: number;
  if (layoutType === "vertical") {
    const bottomRowWidth =
      maxFirstRoundMatches * matchGroupWidth + Math.max(0, maxFirstRoundMatches - 1) * verticalMatchGap;
    canvasWidth = LEFT_PADDING + bottomRowWidth + RIGHT_PADDING;
    canvasHeight =
      TOP_PADDING +
      ROUND_TITLE_HEIGHT +
      roundsCount * matchGroupHeight +
      Math.max(0, roundsCount - 1) * verticalRoundGap +
      BOTTOM_PADDING;
  } else {
    canvasWidth = LEFT_PADDING + RIGHT_PADDING + BOX_WIDTH * columns + ROUND_GAP * Math.max(0, columns - 1);
    canvasHeight =
      TOP_PADDING +
      ROUND_TITLE_HEIGHT +
      BOTTOM_PADDING +
      (maxRows - 1) * basePitch +
      matchGroupHeight;
  }

  return {
    roundsCount,
    firstRoundMatches,
    participantCount,
    boxWidth: BOX_WIDTH,
    boxHeight: BOX_HEIGHT,
    boxInnerGap: BOX_INNER_GAP,
    rowGap: ROW_GAP,
    roundGap: ROUND_GAP,
    leftPadding: LEFT_PADDING,
    rightPadding: RIGHT_PADDING,
    topPadding: TOP_PADDING,
    bottomPadding: BOTTOM_PADDING,
    roundTitleHeight: ROUND_TITLE_HEIGHT,
    columnPitch,
    basePitch,
    matchGroupWidth,
    matchGroupHeight,
    verticalMatchGap,
    verticalRoundGap,
    canvasWidth,
    canvasHeight,
  };
}

export function roundIndexFromRoundNumber(bracket: BoardBracket, roundNumber: number): number {
  const sorted = [...(bracket.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
  const idx = sorted.findIndex((r) => r.roundNumber === roundNumber);
  return idx >= 0 ? idx : 0;
}

export function computeMatchFrame(
  metrics: BracketBoardMetrics,
  roundIndex: number,
  internalMatchIndex: number,
): MatchFrame {
  const exponent = Math.max(0, Math.floor(roundIndex));
  const spacingFactor = 2 ** exponent;
  const centerBaseIndex = spacingFactor * internalMatchIndex + (spacingFactor - 1) / 2;
  const x = metrics.leftPadding + roundIndex * metrics.columnPitch;
  const yCenter =
    metrics.topPadding + metrics.roundTitleHeight + centerBaseIndex * metrics.basePitch + metrics.matchGroupHeight / 2;
  const y = yCenter - metrics.matchGroupHeight / 2;
  return {
    x,
    y,
    width: metrics.boxWidth,
    height: metrics.matchGroupHeight,
  };
}

/**
 * 고정 규칙 기반 트리 좌표 계산 (아래 -> 위).
 * 1라운드 centerX를 먼저 만든 뒤, 상위 라운드 centerX는 하위 2개 centerX 평균으로만 계산한다.
 * 캔버스 크기·배치: 실제 좌표 bbox + pad 후 offset으로 (0,0) 붙음 제거, canvasBounds는 감싼 크기.
 */
function buildVerticalLayout(bracket: BoardBracket, metrics: BracketBoardMetrics): BracketLayoutCalculation {
  const sortedRounds = expandBracketRoundsForTree(bracket);
  if (sortedRounds.length === 0) {
    return { positionedMatches: [], roundTitles: [], connectors: [] };
  }

  const R = sortedRounds.length;
  const firstM = sortedRounds[0]!.matches.length;
  if (firstM <= 0) {
    return { positionedMatches: [], roundTitles: [], connectors: [] };
  }
  const firstRoundSlots = firstM * 2;
  const slotRoundsCount = Math.max(1, Math.round(Math.log2(firstRoundSlots)) + 1);

  const firstRoundCenterX: number[] = [];
  const slotGap = metrics.boxInnerGap;
  const groupPitch = metrics.matchGroupWidth + metrics.verticalMatchGap;
  for (let matchIndex = 0; matchIndex < firstM; matchIndex += 1) {
    const groupLeft = metrics.leftPadding + matchIndex * groupPitch;
    const slot0cx = groupLeft + metrics.boxWidth / 2;
    const slot1cx = slot0cx + metrics.boxWidth + slotGap;
    firstRoundCenterX.push(slot0cx, slot1cx);
  }

  const centerXByRound: number[][] = [firstRoundCenterX];
  for (let r = 1; r < slotRoundsCount; r += 1) {
    const prev = centerXByRound[r - 1]!;
    const nextCount = Math.max(1, Math.ceil(prev.length / 2));
    const row: number[] = [];
    for (let j = 0; j < nextCount; j += 1) {
      const c0 = prev[2 * j] ?? prev[0]!;
      const c1 = prev[2 * j + 1] ?? c0;
      row.push((c0 + c1) / 2);
    }
    centerXByRound.push(row);
  }

  const rowStep = metrics.boxHeight + metrics.verticalRoundGap;
  const bottomRoundCenterY = (slotRoundsCount - 1) * rowStep + metrics.boxHeight / 2;

  const readSlotFromRound = (
    round: BoardRound | undefined,
    slotIndex: number,
  ): { matchId: string; userId: string; name: string; winnerUserId: string | null } => {
    const match = round?.matches[Math.floor(slotIndex / 2)] ?? undefined;
    if (!match) {
      return {
        matchId: `__slot-missing-${round?.roundNumber ?? 0}-${slotIndex}`,
        userId: `__slot-user-${round?.roundNumber ?? 0}-${slotIndex}`,
        name: "대기",
        winnerUserId: null,
      };
    }
    const player = slotIndex % 2 === 0 ? match.player1 : match.player2;
    return {
      matchId: match.id,
      userId: player.userId,
      name: player.name,
      winnerUserId: match.winnerUserId ?? null,
    };
  };

  const readChampionSlot = (): { matchId: string; userId: string; name: string; winnerUserId: string | null } => {
    const finalRound = sortedRounds[sortedRounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    if (!finalMatch) {
      return { matchId: "__champion", userId: "__champion", name: "대기", winnerUserId: null };
    }
    const winnerId = finalMatch.winnerUserId?.trim() ?? "";
    if (winnerId && winnerId === finalMatch.player1.userId) {
      return { matchId: `${finalMatch.id}:champion`, userId: winnerId, name: finalMatch.player1.name, winnerUserId: winnerId };
    }
    if (winnerId && winnerId === finalMatch.player2.userId) {
      return { matchId: `${finalMatch.id}:champion`, userId: winnerId, name: finalMatch.player2.name, winnerUserId: winnerId };
    }
    return { matchId: `${finalMatch.id}:champion`, userId: "__champion", name: "대기", winnerUserId: null };
  };

  const positionedMatches: PositionedBoardMatch[] = [];
  for (let roundIdx = 0; roundIdx < slotRoundsCount; roundIdx += 1) {
    const centers = centerXByRound[roundIdx] ?? [];
    const cy = bottomRoundCenterY - roundIdx * rowStep;
    for (let slotIndex = 0; slotIndex < centers.length; slotIndex += 1) {
      const cx = centers[slotIndex] ?? metrics.leftPadding + metrics.boxWidth / 2;
      const x = cx - metrics.boxWidth / 2;
      const y = cy - metrics.boxHeight / 2;
      const slot =
        roundIdx < sortedRounds.length
          ? readSlotFromRound(sortedRounds[roundIdx], slotIndex)
          : readChampionSlot();
      positionedMatches.push({
        key: `${roundIdx + 1}:${slotIndex}`,
        roundNumber: roundIdx + 1,
        roundIndex: roundIdx,
        internalIndex: slotIndex,
        match: {
          id: slot.matchId,
          player1: { userId: slot.userId, name: slot.name },
          player2: { userId: "__none", name: "" },
          winnerUserId: slot.winnerUserId,
          winnerName: slot.winnerUserId ? slot.name : null,
          status: slot.winnerUserId ? "COMPLETED" : "PENDING",
        },
        frame: { x, y, width: metrics.boxWidth, height: metrics.boxHeight },
      });
    }
  }

  const FINAL_WINNER_SLOT_SCALE = 2;
  const finalRoundIdx = slotRoundsCount - 1;
  for (const item of positionedMatches) {
    if (item.roundIndex !== finalRoundIdx) continue;
    const f = item.frame;
    const midX = f.x + f.width / 2;
    const bottom = f.y + f.height;
    const nw = f.width * FINAL_WINNER_SLOT_SCALE;
    const nh = f.height * FINAL_WINNER_SLOT_SCALE;
    item.frame = { x: midX - nw / 2, y: bottom - nh, width: nw, height: nh };
  }

  const slotByKey = new Map<string, PositionedBoardMatch>();
  for (const item of positionedMatches) slotByKey.set(item.key, item);

  const connectors: ConnectorGeometry[] = [];
  for (let r = 0; r < slotRoundsCount - 1; r += 1) {
    const childCount = centerXByRound[r]?.length ?? 0;
    const parentCount = centerXByRound[r + 1]?.length ?? 0;
    for (let j = 0; j < parentCount; j += 1) {
      const c0 = slotByKey.get(`${r + 1}:${2 * j}`);
      const c1 = slotByKey.get(`${r + 1}:${2 * j + 1}`);
      const p = slotByKey.get(`${r + 2}:${j}`);
      if (!c0 || !p) continue;
      const c0x = c0.frame.x + c0.frame.width / 2;
      const c0Top = c0.frame.y;
      const px = p.frame.x + p.frame.width / 2;
      const pBottom = p.frame.y + p.frame.height;
      if (!c1 || 2 * j + 1 >= childCount) {
        const joinY = (c0Top + pBottom) / 2;
        connectors.push({
          key: `${r + 1}:${2 * j}->${r + 2}:${j}`,
          basePaths: [`M ${c0x} ${c0Top} L ${c0x} ${joinY} L ${px} ${joinY} L ${px} ${pBottom}`],
          winnerPath: null,
        });
        continue;
      }
      const c1x = c1.frame.x + c1.frame.width / 2;
      const c1Top = c1.frame.y;
      const mergeX = (c0x + c1x) / 2;
      const joinY = ((c0Top + c1Top) / 2 + pBottom) / 2;
      connectors.push({
        key: `${r + 1}:${2 * j}+${r + 1}:${2 * j + 1}->${r + 2}:${j}`,
        basePaths: [
          `M ${c0x} ${c0Top} L ${c0x} ${joinY} L ${mergeX} ${joinY}`,
          `M ${c1x} ${c1Top} L ${c1x} ${joinY} L ${mergeX} ${joinY}`,
          `M ${mergeX} ${joinY} L ${px} ${joinY} L ${px} ${pBottom}`,
        ],
        winnerPath: null,
      });
    }
  }

  const roundTitles: RoundTitleAnchor[] = Array.from({ length: slotRoundsCount }, (_, roundIdx) => {
    const inRound = positionedMatches.filter((p) => p.roundIndex === roundIdx);
    const firstInRound = inRound[0];
    let minY = Infinity;
    for (const item of inRound) minY = Math.min(minY, item.frame.y);
    return {
      key: `R${roundIdx + 1}`,
      roundNumber: roundIdx + 1,
      roundIndex: roundIdx,
      matchCount: inRound.length,
      x: firstInRound ? firstInRound.frame.x : 0,
      y: Number.isFinite(minY) ? minY - 22 : 0,
    };
  });

  const pad = VERTICAL_CANVAS_PAD + VERTICAL_STROKE_PAD;

  const growBox = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): [number, number, number, number] => [
    Math.min(minX, x),
    Math.min(minY, y),
    Math.max(maxX, x + w),
    Math.max(maxY, y + h),
  ];

  const growPoint = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    px: number,
    py: number,
  ): [number, number, number, number] => [
    Math.min(minX, px),
    Math.min(minY, py),
    Math.max(maxX, px),
    Math.max(maxY, py),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of positionedMatches) {
    const { x, y, width, height } = item.frame;
    [minX, minY, maxX, maxY] = growBox(minX, minY, maxX, maxY, x, y, width, height);
  }

  for (const t of roundTitles) {
    const ty = t.y ?? 0;
    [minX, minY, maxX, maxY] = growBox(minX, minY, maxX, maxY, t.x, ty, ROUND_TITLE_BBOX_W, ROUND_TITLE_BBOX_H);
  }

  for (const c of connectors) {
    for (const d of c.basePaths) {
      const parts = d.trim().split(/\s+/);
      let i = 0;
      while (i < parts.length) {
        const tok = parts[i];
        if (tok === "M" || tok === "L") {
          const px = Number(parts[i + 1]);
          const py = Number(parts[i + 2]);
          [minX, minY, maxX, maxY] = growPoint(minX, minY, maxX, maxY, px, py);
          i += 3;
        } else {
          i += 1;
        }
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { positionedMatches: [], roundTitles: [], connectors: [] };
  }

  const offsetX = -minX + pad;
  const offsetY = -minY + pad;

  for (const item of positionedMatches) {
    item.frame.x += offsetX;
    item.frame.y += offsetY;
  }
  for (const t of roundTitles) {
    t.x += offsetX;
    t.y = (t.y ?? 0) + offsetY;
  }
  for (const c of connectors) {
    c.basePaths = c.basePaths.map((d) => offsetSvgPathD(d, offsetX, offsetY));
    if (c.winnerPath) c.winnerPath = offsetSvgPathD(c.winnerPath, offsetX, offsetY);
  }

  const rawW = maxX - minX + 2 * pad;
  const rawH = maxY - minY + 2 * pad;
  let canvasW = Math.ceil(rawW);
  let canvasH = Math.ceil(rawH);

  /** bbox 반올림 후에도 모든 점이 안쪽에 들어가도록 한 번 더 확장 */
  for (let iter = 0; iter < 4; iter += 1) {
    let mx = -Infinity;
    let my = -Infinity;
    for (const item of positionedMatches) {
      mx = Math.max(mx, item.frame.x + item.frame.width);
      my = Math.max(my, item.frame.y + item.frame.height);
    }
    for (const t of roundTitles) {
      const ty = t.y ?? 0;
      mx = Math.max(mx, t.x + ROUND_TITLE_BBOX_W);
      my = Math.max(my, ty + ROUND_TITLE_BBOX_H);
    }
    for (const c of connectors) {
      for (const d of c.basePaths) {
        const parts = d.trim().split(/\s+/);
        let i = 0;
        while (i < parts.length) {
          const tok = parts[i];
          if (tok === "M" || tok === "L") {
            mx = Math.max(mx, Number(parts[i + 1]));
            my = Math.max(my, Number(parts[i + 2]));
            i += 3;
          } else {
            i += 1;
          }
        }
      }
    }
    const needW = Math.ceil(mx + pad);
    const needH = Math.ceil(my + pad);
    if (needW <= canvasW && needH <= canvasH) break;
    canvasW = Math.max(canvasW, needW);
    canvasH = Math.max(canvasH, needH);
  }

  return {
    positionedMatches,
    roundTitles,
    connectors,
    canvasBounds: { width: canvasW, height: canvasH },
  };
}

/** 기존 단일 고정 레이아웃 계산을 그대로 분리 */
export function calculateLayoutVertical(bracket: BoardBracket, metrics: BracketBoardMetrics): BracketLayoutCalculation {
  return buildVerticalLayout(bracket, metrics);
}

/** 2.5단계 골격: 실제 가로 배치는 다음 단계에서 구현 */
export function calculateLayoutHorizontal(bracket: BoardBracket, metrics: BracketBoardMetrics): BracketLayoutCalculation {
  return buildVerticalLayout(bracket, metrics);
}

/** 2.5단계 골격: 중앙형(좌/우 트리 + 결승)은 다음 단계에서 구현 */
export function calculateLayoutCenter(bracket: BoardBracket, metrics: BracketBoardMetrics): BracketLayoutCalculation {
  const sortedRounds = [...(bracket.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber);
  if (sortedRounds.length === 0) {
    return { positionedMatches: [], roundTitles: [], connectors: [] };
  }

  const sideRounds = Math.max(0, sortedRounds.length - 1);
  const contentTop = metrics.topPadding + metrics.roundTitleHeight;
  const contentHeight = (Math.max(1, Math.ceil(metrics.firstRoundMatches / 2)) - 1) * metrics.basePitch + metrics.matchGroupHeight;

  const computeSideY = (sideRoundIndex: number, sideInternalIndex: number): number => {
    const exponent = Math.max(0, Math.floor(sideRoundIndex));
    const spacingFactor = 2 ** exponent;
    const centerBaseIndex = spacingFactor * sideInternalIndex + (spacingFactor - 1) / 2;
    const yCenter = contentTop + centerBaseIndex * metrics.basePitch + metrics.matchGroupHeight / 2;
    return yCenter - metrics.matchGroupHeight / 2;
  };

  const positionedMatches: PositionedBoardMatch[] = [];
  sortedRounds.forEach((round, roundIndex) => {
    const isFinalRound = roundIndex === sortedRounds.length - 1 && round.matches.length === 1;
    if (isFinalRound) {
      const finalColumn = sideRounds;
      const x = metrics.leftPadding + finalColumn * metrics.columnPitch;
      const y = contentTop + contentHeight / 2 - metrics.matchGroupHeight / 2;
      positionedMatches.push({
        key: `${round.roundNumber}:0`,
        roundNumber: round.roundNumber,
        roundIndex,
        internalIndex: 0,
        match: round.matches[0]!,
        frame: { x, y, width: metrics.boxWidth, height: metrics.matchGroupHeight },
      });
      return;
    }

    const split = Math.ceil(round.matches.length / 2);
    round.matches.forEach((match, internalIndex) => {
      const isLeft = internalIndex < split;
      const sideInternalIndex = isLeft ? internalIndex : internalIndex - split;
      const columnIndex = isLeft ? roundIndex : sideRounds + 1 + (sideRounds - 1 - roundIndex);
      const x = metrics.leftPadding + columnIndex * metrics.columnPitch;
      const y = computeSideY(roundIndex, sideInternalIndex);
      positionedMatches.push({
        key: `${round.roundNumber}:${internalIndex}`,
        roundNumber: round.roundNumber,
        roundIndex,
        internalIndex,
        match,
        frame: { x, y, width: metrics.boxWidth, height: metrics.matchGroupHeight },
      });
    });
  });

  const positionedMatchMap = new Map<string, PositionedBoardMatch>();
  for (const item of positionedMatches) positionedMatchMap.set(item.key, item);

  const connectors: ConnectorGeometry[] = [];
  const elbow = 16;
  for (const item of positionedMatches) {
    const nextRoundNumber = item.roundNumber + 1;
    const nextKey = `${nextRoundNumber}:${Math.floor(item.internalIndex / 2)}`;
    const next = positionedMatchMap.get(nextKey);
    if (!next) continue;

    const isRightToLeft = next.frame.x < item.frame.x;
    const sourceEdgeX = isRightToLeft ? item.frame.x : item.frame.x + item.frame.width;
    const targetEdgeX = isRightToLeft ? next.frame.x + next.frame.width : next.frame.x;
    const elbowX = isRightToLeft ? sourceEdgeX - elbow : sourceEdgeX + elbow;
    const p1y = item.frame.y + metrics.boxHeight / 2;
    const p2y = item.frame.y + metrics.boxHeight + metrics.boxInnerGap + metrics.boxHeight / 2;
    const midY = (p1y + p2y) / 2;

    const targetSlot = item.internalIndex % 2 === 0 ? "player1" : "player2";
    const targetY =
      next.frame.y +
      (targetSlot === "player1" ? metrics.boxHeight / 2 : metrics.boxHeight + metrics.boxInnerGap + metrics.boxHeight / 2);

    const basePaths = [
      `M ${sourceEdgeX} ${p1y} L ${elbowX} ${p1y} L ${elbowX} ${midY}`,
      `M ${sourceEdgeX} ${p2y} L ${elbowX} ${p2y} L ${elbowX} ${midY}`,
      `M ${elbowX} ${midY} L ${targetEdgeX + (isRightToLeft ? 10 : -10)} ${midY} L ${
        targetEdgeX + (isRightToLeft ? 10 : -10)
      } ${targetY} L ${targetEdgeX} ${targetY}`,
    ];

    let winnerPath: string | null = null;
    const winnerId = item.match.winnerUserId?.trim() ?? "";
    if (winnerId) {
      const winnerSlot =
        item.match.player1.userId === winnerId ? "player1" : item.match.player2.userId === winnerId ? "player2" : null;
      const targetPlayerId = targetSlot === "player1" ? next.match.player1.userId : next.match.player2.userId;
      if (winnerSlot && targetPlayerId === winnerId) {
        const winnerY =
          item.frame.y +
          (winnerSlot === "player1" ? metrics.boxHeight / 2 : metrics.boxHeight + metrics.boxInnerGap + metrics.boxHeight / 2);
        winnerPath = `M ${sourceEdgeX} ${winnerY} L ${elbowX} ${winnerY} L ${elbowX} ${targetY} L ${targetEdgeX} ${targetY}`;
      }
    }

    connectors.push({
      key: `${item.key}->${nextKey}`,
      basePaths,
      winnerPath,
    });
  }

  const roundTitles: RoundTitleAnchor[] = [];
  sortedRounds.forEach((round, roundIndex) => {
    const isFinalRound = roundIndex === sortedRounds.length - 1 && round.matches.length === 1;
    if (isFinalRound) {
      roundTitles.push({
        key: `R${round.roundNumber}:C`,
        roundNumber: round.roundNumber,
        roundIndex,
        matchCount: round.matches.length,
        x: metrics.leftPadding + sideRounds * metrics.columnPitch,
      });
      return;
    }
    const leftX = metrics.leftPadding + roundIndex * metrics.columnPitch;
    const rightX = metrics.leftPadding + (sideRounds + 1 + (sideRounds - 1 - roundIndex)) * metrics.columnPitch;
    roundTitles.push({
      key: `R${round.roundNumber}:L`,
      roundNumber: round.roundNumber,
      roundIndex,
      matchCount: Math.ceil(round.matches.length / 2),
      x: leftX,
    });
    roundTitles.push({
      key: `R${round.roundNumber}:R`,
      roundNumber: round.roundNumber,
      roundIndex,
      matchCount: Math.floor(round.matches.length / 2),
      x: rightX,
    });
  });

  return { positionedMatches, roundTitles, connectors };
}

export function calculateLayout(
  bracket: BoardBracket,
  metrics: BracketBoardMetrics,
  layoutType: BracketLayoutType,
): BracketLayoutCalculation {
  if (layoutType === "vertical") return calculateLayoutVertical(bracket, metrics);
  if (layoutType === "horizontal") return calculateLayoutHorizontal(bracket, metrics);
  return calculateLayoutCenter(bracket, metrics);
}

export function computeStressCanvasSize(
  participantCount: number,
  layoutType: BracketLayoutType = "vertical",
): { roundsCount: number; width: number; height: number } {
  const p = Math.max(2, safePositiveInt(participantCount));
  const firstRoundMatches = Math.max(1, Math.floor(p / 2));
  const roundsCount = Math.max(1, Math.round(Math.log2(firstRoundMatches * 2)));
  const metrics = computeBracketBoardMetrics(
    {
    rounds: [
      {
        roundNumber: 1,
        status: "PENDING",
        matches: Array.from({ length: firstRoundMatches }, (_, idx) => ({
          id: String(idx),
          player1: { userId: `p1-${idx}`, name: `P1-${idx}` },
          player2: { userId: `p2-${idx}`, name: `P2-${idx}` },
          winnerUserId: null,
          winnerName: null,
          status: "PENDING" as const,
        })),
      },
    ],
    },
    layoutType,
  );
  return { roundsCount, width: metrics.canvasWidth, height: metrics.canvasHeight };
}
