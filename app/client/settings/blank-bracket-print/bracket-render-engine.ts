/**
 * bracket-render-engine.ts
 *
 * 모든 좌표는 mm 단위.
 * SVG viewBox="0 0 277 190" 에 직접 전달하면 인쇄 크기가 정확히 맞는다.
 *
 * 가로축 (spread): 박스 폭 합계 = 240mm, 간격 합계 = 37mm
 * 세로축 (round):  bh:lh = 1:0.8
 * 선 두께 = 0.2mm (strokeWidth 으로 SVG 에 전달)
 */

export type BracketScene = {
  boxes: { x: number; y: number; w: number; h: number }[];
  lines: { x1: number; y1: number; x2: number; y2: number }[];
};

/** 시작 라운드 2슬롯=1조 보조 번호 (좌표만 — 박스·선 계산과 무관) */
export type StartPairLabel = {
  x: number;
  y: number;
  text: string;
  textAnchor: "start" | "middle" | "end";
};

const PAIR_LABEL_OUT_MM = 2.3;

export type BuildOpts = {
  rounds:     number[];
  style:      "TREE" | "CENTER";
  treeLayout: "HORIZONTAL" | "VERTICAL";
};

const W  = 277;   // 캔버스 너비 (mm)
const H  = 190;   // 캔버스 높이 (mm)
const BS = 240;   // 박스 폭 합 (mm)
const GS = 37;    // 간격 합 (mm)

/**
 * coord(r, j, step, size)
 * 라운드 r, 박스 j 의 중심 좌표.
 * - 1라운드 박스 k 의 중심 = k*step + size/2
 * - r라운드 박스 j 는 1라운드 박스 k1..k2 의 중앙 (k1=j*2^r, k2=(j+1)*2^r-1)
 */
function coord(r: number, j: number, step: number, size: number): number {
  const p = Math.pow(2, r);
  // center = ((k1 + k2) / 2) * step + size / 2
  //        = ((2j*p + p - 1) / 2) * step + size / 2
  return ((2 * j * p + p - 1) * step) / 2 + size / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────────────────────
export function buildBracketScene({ rounds, style, treeLayout }: BuildOpts): BracketScene {
  if (!rounds.length) return { boxes: [], lines: [] };
  if (style === "CENTER")      return buildCenter(rounds);
  if (treeLayout === "VERTICAL") return buildVertical(rounds);
  return buildHorizontal(rounds);
}

/**
 * 시작 라운드에서 연속 2슬롯을 1조로 보고 1…N/2 번호만 계산한다.
 * scene 의 박스 좌표는 변경하지 않는다.
 */
export function buildStartPairLabels(scene: BracketScene, opts: BuildOpts): StartPairLabel[] {
  const { rounds, style, treeLayout } = opts;
  if (!rounds.length) return [];
  const N = rounds[0]!;
  if (N < 2 || N % 2 !== 0) return [];
  const { boxes } = scene;
  if (boxes.length < N) return [];

  const out: StartPairLabel[] = [];
  let gn = 1;

  if (style === "CENTER") {
    const finalEnd = rounds[rounds.length - 1] === 1;
    const baseRounds = finalEnd ? rounds.slice(0, -1) : rounds;
    const sideRounds = baseRounds.map((n) => Math.max(1, Math.floor(n / 2)));
    const L = sideRounds.length;
    const s0 = sideRounds[0]!;
    const pairsSide = s0 / 2;
    let leftTotal = 0;
    for (let r = 0; r < L; r++) leftTotal += sideRounds[r]!;

    for (let k = 0; k < pairsSide; k++) {
      const a = boxes[2 * k]!;
      const b = boxes[2 * k + 1]!;
      const midY = (a.y + a.h + b.y) * 0.5;
      out.push({ x: a.x - PAIR_LABEL_OUT_MM, y: midY, text: String(gn++), textAnchor: "end" });
    }
    const rb = leftTotal;
    for (let k = 0; k < pairsSide; k++) {
      const a = boxes[rb + 2 * k]!;
      const b = boxes[rb + 2 * k + 1]!;
      const midY = (a.y + a.h + b.y) * 0.5;
      out.push({ x: a.x + a.w + PAIR_LABEL_OUT_MM, y: midY, text: String(gn++), textAnchor: "start" });
    }
    return out;
  }

  if (treeLayout === "VERTICAL") {
    const rowTop = boxes[0]!.y;
    for (let k = 0; k < N / 2; k++) {
      const a = boxes[2 * k]!;
      const b = boxes[2 * k + 1]!;
      const midX = (a.x + a.w + b.x) * 0.5;
      out.push({
        x: midX,
        y: rowTop - PAIR_LABEL_OUT_MM,
        text: String(gn++),
        textAnchor: "middle",
      });
    }
    return out;
  }

  /* TREE HORIZONTAL */
  for (let k = 0; k < N / 2; k++) {
    const a = boxes[2 * k]!;
    const b = boxes[2 * k + 1]!;
    const midY = (a.y + a.h + b.y) * 0.5;
    out.push({ x: a.x - PAIR_LABEL_OUT_MM, y: midY, text: String(gn++), textAnchor: "end" });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERTICAL (아래 → 위)
// X: 1라운드 N개 박스가 277mm 를 꽉 채운다
//    bw = 240/N,  gw = 37/(N-1)
//    box i 왼쪽 = i*(bw+gw)   →   마지막 오른쪽 = 277mm ✓
// Y: L개 박스층 + (L-1)개 선층
//    bh = 190 / (L + (L-1)*0.8),  lh = bh*0.8
//    라운드 0(최하단) top = 190-bh,  라운드 L-1(최상단) top = 0mm ✓
// ─────────────────────────────────────────────────────────────────────────────
function buildVertical(rounds: number[]): BracketScene {
  const N  = rounds[0];
  const bw = BS / N;
  const gw = N > 1 ? GS / (N - 1) : 0;
  const st = bw + gw;          // 1라운드 박스 피치

  const L  = rounds.length;
  const bh = H / (L + (L - 1) * 0.8);
  const lh = bh * 0.8;

  const boxes: BracketScene["boxes"] = [];
  const lines: BracketScene["lines"] = [];

  // 박스 배치
  for (let r = 0; r < L; r++) {
    // yTop: 라운드 r 의 박스 위쪽 y
    // r=0 → H-bh  (캔버스 맨 아래),  r=L-1 → 0 (캔버스 맨 위)
    const yTop = H - (r + 1) * (bh + lh) + lh;
    for (let j = 0; j < rounds[r]; j++) {
      const cx = coord(r, j, st, bw);
      boxes.push({ x: cx - bw / 2, y: yTop, w: bw, h: bh });
    }
  }

  // 포크 경로선 (child → fork → parent)
  for (let r = 0; r < L - 1; r++) {
    const childTop  = H - (r + 1) * (bh + lh) + lh;
    const forkY     = childTop - lh / 2;   // 선 공간의 정중앙
    const parentBtm = childTop - lh;       // 다음 라운드 박스 아랫면

    for (let j = 0; j < rounds[r]; j += 2) {
      const c1 = coord(r,     j,     st, bw);
      const c2 = coord(r,     j + 1, st, bw);
      const cp = coord(r + 1, j / 2, st, bw);

      lines.push({ x1: c1, y1: childTop,  x2: c1, y2: forkY     }); // child1 수직
      lines.push({ x1: c2, y1: childTop,  x2: c2, y2: forkY     }); // child2 수직
      lines.push({ x1: c1, y1: forkY,     x2: c2, y2: forkY     }); // 수평 연결
      lines.push({ x1: cp, y1: forkY,     x2: cp, y2: parentBtm }); // parent 수직
    }
  }

  return { boxes, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL (좌 → 우)
// Y: 1라운드 N개 박스가 190mm 를 꽉 채운다 (277mm 비율 그대로 스케일)
//    bh = 190*(240/277)/N,  gy = 190*(37/277)/(N-1)
//    box i 위쪽 = i*(bh+gy)   →   마지막 아래쪽 = 190mm ✓
// X: L개 라운드 열이 277mm 를 꽉 채운다
//    bw = 277 / (L + (L-1)*0.8),  lw = bw*0.8
// ─────────────────────────────────────────────────────────────────────────────
function buildHorizontal(rounds: number[]): BracketScene {
  const N   = rounds[0];
  const bh  = (H * BS) / W / N;
  const gy  = N > 1 ? (H * GS) / W / (N - 1) : 0;
  const stY = bh + gy;

  const L   = rounds.length;
  const bw  = W / (L + (L - 1) * 0.8);
  const lw  = bw * 0.8;
  const stX = bw + lw;

  const boxes: BracketScene["boxes"] = [];
  const lines: BracketScene["lines"] = [];

  for (let r = 0; r < L; r++) {
    const xL = r * stX;
    for (let j = 0; j < rounds[r]; j++) {
      const cy = coord(r, j, stY, bh);
      boxes.push({ x: xL, y: cy - bh / 2, w: bw, h: bh });
    }
  }

  for (let r = 0; r < L - 1; r++) {
    const childXR  = r * stX + bw;      // child 열 오른쪽
    const forkX    = childXR + lw / 2;  // 선 공간 정중앙
    const parentXL = (r + 1) * stX;     // parent 열 왼쪽

    for (let j = 0; j < rounds[r]; j += 2) {
      const cy1 = coord(r,     j,     stY, bh);
      const cy2 = coord(r,     j + 1, stY, bh);
      const cyP = coord(r + 1, j / 2, stY, bh);

      lines.push({ x1: childXR, y1: cy1, x2: forkX,    y2: cy1 }); // child1 수평
      lines.push({ x1: childXR, y1: cy2, x2: forkX,    y2: cy2 }); // child2 수평
      lines.push({ x1: forkX,   y1: cy1, x2: forkX,    y2: cy2 }); // 수직 연결
      lines.push({ x1: forkX,   y1: cyP, x2: parentXL, y2: cyP }); // parent 수평
    }
  }

  return { boxes, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTER (양쪽 → 중앙)
// 가로형 트리 2개를 좌우 대칭 배치.
// 수식: 2*sideWidth + lw = 277  →  bw*(2L + (2LL+1)*0.8) = 277
// 우승자 박스 x중심 = 277/2 (수학적 정중앙)
// ─────────────────────────────────────────────────────────────────────────────
function buildCenter(rounds: number[]): BracketScene {
  const finalEnd   = rounds[rounds.length - 1] === 1;
  const baseRounds = finalEnd ? rounds.slice(0, -1) : rounds;
  const sideRounds = baseRounds.map(n => Math.max(1, Math.floor(n / 2)));

  const N  = sideRounds[0];
  const L  = sideRounds.length;
  const LL = L - 1;

  // Y (각 사이드의 N개 박스)
  const bh  = (H * BS) / W / N;
  const gy  = N > 1 ? (H * GS) / W / (N - 1) : 0;
  const stY = bh + gy;

  // X: 2*sideWidth + lw(champion gap) = 277
  //    sideWidth = bw*(L + LL*0.8)
  //    ⟹  bw * (2L + (2LL+1)*0.8) = 277
  const bw   = W / (2 * L + (2 * LL + 1) * 0.8);
  const lw   = bw * 0.8;
  const stX  = bw + lw;
  const sideW = bw * (L + LL * 0.8);  // 왼쪽 트리 전체 너비 = sideWidth

  const boxes: BracketScene["boxes"] = [];
  const lines: BracketScene["lines"] = [];

  // ── 왼쪽 트리 ──────────────────────────────────────────────────────────────
  for (let r = 0; r < L; r++) {
    const xL = r * stX;
    for (let j = 0; j < sideRounds[r]; j++) {
      const cy = coord(r, j, stY, bh);
      boxes.push({ x: xL, y: cy - bh / 2, w: bw, h: bh });
    }
  }
  for (let r = 0; r < L - 1; r++) {
    const cXR  = r * stX + bw;
    const fX   = cXR + lw / 2;
    const pXL  = (r + 1) * stX;
    for (let j = 0; j < sideRounds[r]; j += 2) {
      const cy1 = coord(r,     j,     stY, bh);
      const cy2 = coord(r,     j + 1, stY, bh);
      const cyP = coord(r + 1, j / 2, stY, bh);
      lines.push({ x1: cXR, y1: cy1, x2: fX,  y2: cy1 });
      lines.push({ x1: cXR, y1: cy2, x2: fX,  y2: cy2 });
      lines.push({ x1: fX,  y1: cy1, x2: fX,  y2: cy2 });
      lines.push({ x1: fX,  y1: cyP, x2: pXL, y2: cyP });
    }
  }

  // ── 오른쪽 트리 (좌우 반전) ────────────────────────────────────────────────
  // 라운드 r 의 열: x_left = W - r*stX - bw  (오른쪽 끝에서 안쪽으로)
  for (let r = 0; r < L; r++) {
    const xL = W - r * stX - bw;
    for (let j = 0; j < sideRounds[r]; j++) {
      const cy = coord(r, j, stY, bh);
      boxes.push({ x: xL, y: cy - bh / 2, w: bw, h: bh });
    }
  }
  for (let r = 0; r < L - 1; r++) {
    // child 열 왼쪽 모서리, parent 열 오른쪽 모서리, 포크 x
    const cXL  = W - r * stX - bw;
    const pXR  = W - (r + 1) * stX;
    const fX   = (cXL + pXR) / 2;    // = cXL - lw/2 = pXR + lw/2
    for (let j = 0; j < sideRounds[r]; j += 2) {
      const cy1 = coord(r,     j,     stY, bh);
      const cy2 = coord(r,     j + 1, stY, bh);
      const cyP = coord(r + 1, j / 2, stY, bh);
      lines.push({ x1: cXL, y1: cy1, x2: fX,  y2: cy1 });
      lines.push({ x1: cXL, y1: cy2, x2: fX,  y2: cy2 });
      lines.push({ x1: fX,  y1: cy1, x2: fX,  y2: cy2 });
      lines.push({ x1: fX,  y1: cyP, x2: pXR, y2: cyP });
    }
  }

  // ── 우승자 연결 ────────────────────────────────────────────────────────────
  if (finalEnd) {
    // 각 사이드 최종 1개 박스 중심 y
    const meetY = coord(L - 1, 0, stY, bh);
    const midX  = W / 2;                       // = sideW + lw/2 ✓ (수학적 정중앙)

    // 좌→중앙, 우→중앙 수평선
    lines.push({ x1: sideW,    y1: meetY, x2: midX, y2: meetY });
    lines.push({ x1: W - sideW, y1: meetY, x2: midX, y2: meetY });

    // 중앙에서 위로 세로선 → 우승자 박스
    const champTop = Math.max(0, meetY - lw - bh);
    lines.push({ x1: midX, y1: meetY, x2: midX, y2: champTop + bh });
    boxes.push({ x: midX - bw / 2, y: champTop, w: bw, h: bh });
  }

  return { boxes, lines };
}
