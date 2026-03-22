"use client";

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  getPlayfieldRect,
  getPlayfieldLongSide,
  normalizedToPixel,
  landscapeToPortraitNorm,
  portraitToLandscapeNorm,
  getBallRadius,
  FRAME_INSET,
  PLAYFIELD_INSET,
  PATH_SPOT_RADIUS_PX,
  type PlayfieldRect,
  type BallColor,
  type CueBallType,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import type { BilliardPath } from "@/lib/billiard-path-types";

export interface BallPositions {
  red: { x: number; y: number };
  yellow: { x: number; y: number };
  white: { x: number; y: number };
}

const PATH_LINE_WIDTH = 2.5;
const PATH_LINE_CAP = "round" as CanvasLineCap;
const ARROW_LENGTH = 12;
const ARROW_ANGLE_DEG = 30;

function getPathStartPoint(
  path: BilliardPath,
  cueBall: CueBallType,
  whiteBall: { x: number; y: number },
  yellowBall: { x: number; y: number }
): { x: number; y: number } {
  if (path.start.type === "cueBall") {
    return cueBall === "white" ? whiteBall : yellowBall;
  }
  return { x: path.start.x, y: path.start.y };
}

function drawPaths(
  ctx: CanvasRenderingContext2D,
  rect: PlayfieldRect,
  paths: BilliardPath[],
  cueBall: CueBallType,
  whiteBall: { x: number; y: number },
  yellowBall: { x: number; y: number },
  normToView?: (x: number, y: number) => { x: number; y: number }
) {
  if (!paths.length) return;
  const toView = normToView ?? ((x: number, y: number) => ({ x, y }));

  paths.forEach((path) => {
    const start = getPathStartPoint(path, cueBall, whiteBall, yellowBall);
    const allPoints = [start, ...path.points];
    if (allPoints.length < 2) return;

    const totalSegments = allPoints.length - 1;

    const pathColor = "rgb(57,255,20)"; // 형광연두색 (수구표시선과 동일)
    for (let i = 0; i < totalSegments; i++) {
      const va = toView(allPoints[i].x, allPoints[i].y);
      const vb = toView(allPoints[i + 1].x, allPoints[i + 1].y);
      const a = normalizedToPixel(va.x, va.y, rect);
      const b = normalizedToPixel(vb.x, vb.y, rect);
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = PATH_LINE_WIDTH;
      ctx.lineCap = PATH_LINE_CAP;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();

      const isLastSegment = i === totalSegments - 1;
      if (isLastSegment) {
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const angle = Math.atan2(dy, dx);
        const rad = (ARROW_ANGLE_DEG * Math.PI) / 180;
        ctx.fillStyle = pathColor;
        ctx.beginPath();
        ctx.moveTo(b.px, b.py);
        ctx.lineTo(
          b.px - ARROW_LENGTH * Math.cos(angle - rad),
          b.py - ARROW_LENGTH * Math.sin(angle - rad)
        );
        ctx.lineTo(
          b.px - ARROW_LENGTH * Math.cos(angle + rad),
          b.py - ARROW_LENGTH * Math.sin(angle + rad)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    allPoints.forEach((p) => {
      const v = toView(p.x, p.y);
      const { px, py } = normalizedToPixel(v.x, v.y, rect);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, PATH_SPOT_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });
}

export interface BilliardTableCanvasProps {
  width?: number;
  height?: number;
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
  showGrid?: boolean;
  selectedBall?: BallColor | null;
  /** 클릭(단일 탭) 시 — 레거시 */
  onTableClick?: (normalized: { x: number; y: number }) => void;
  /** 포인터 다운/무브/업 — 공 직접 선택·드래그 이동용 */
  onPointerDown?: (normalized: { x: number; y: number }) => void;
  onPointerMove?: (normalized: { x: number; y: number }) => void;
  onPointerUp?: () => void;
  interactive?: boolean;
  /** 경로 (저장 이미지에 포함) */
  paths?: BilliardPath[];
  /** 가로형 / 세로형. 좌표는 항상 landscape 0..1 기준. */
  orientation?: TableOrientation;
  /** 실사보기(저장 기본) | 단순보기(와이어프레임). 저장 시 기본 이미지는 항상 realistic. */
  drawStyle?: TableDrawStyle;
  /** true면 수구를 둘러싼 회색 원을 깜빡이게 표시 (난구 해법 출발선 스팟). 저장 이미지에는 미포함. */
  showCueBallSpot?: boolean;
  /** 1목 경로 그리기 모드: 해당 공에 진한 파랑 점선 스팟 깜빡임 (저장 이미지 미포함) */
  showObjectBallSpot?: boolean;
  /** `showObjectBallSpot`일 때 점선을 그릴 공 (수구 제외 목적구) */
  objectBallSpotKey?: BallColor | null;
  /** 난구 공배치 모드: 선택 시 지름 4배 검정 반투명 원, 크로스헤어 미표시 */
  placementMode?: boolean;
  /** 공배치 시 선택된 공 기준 플레이필드 전체 십자선(+) 표시 */
  showCrosshairAtSelected?: boolean;
  /** true면 1목적구(red) 미표시 — 애니메이션 시연 등 */
  hideRedBall?: boolean;
  /** 경로 재생 등: landscape 정규화 좌표로 공 위치 덮어쓰기 (미지정 색은 placement 유지) */
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  /** 고정 부모(W×H) 안에 100% 채움 (줌 쉘 등). false면 기존 min(100%,dvh) 맞춤 */
  embedFill?: boolean;
  /**
   * true면 테이블(쿠션·필드)과 공을 분리: 아래 캔버스=테이블만, `children`=중간(SVG 경로 등), 위 캔버스=공만.
   * 경로선이 공 아래로 가게 할 때 사용. 위 공 캔버스는 pointer-events: none.
   */
  splitBallLayer?: boolean;
  /** `splitBallLayer`일 때 테이블과 공 사이에 렌더 (경로 오버레이 등) */
  children?: ReactNode;
}

export interface BilliardTableCanvasHandle {
  /** includeGrid: 그리드 포함. forceLandscape: 가로형으로 내보냄. forceStyle: 저장 시 사용할 스타일(미지정 시 realistic=실사 기본이미지). */
  getDataURL: (includeGrid: boolean, forceLandscape?: boolean, forceStyle?: TableDrawStyle) => string;
}

/** 프레임 모서리 반경. 쿠션필드는 직각 */
const FRAME_CORNER_RADIUS = 9;
const CUSHION_CORNER_RADIUS = 0;

/** 실사보기 = 저장용 기본 이미지, 단순보기 = 와이어프레임 */
export type TableDrawStyle = "realistic" | "wireframe";

/** 플레이필드 단순보기용 아주 밝은 하늘색 */
const WIREFRAME_PLAYFIELD_FILL = "#e0f4ff";

/**
 * 도면 기준 4영역: 1.프레임 2.포인트(프레임 위) 3.쿠션필드 4.플레이필드.
 * drawStyle: realistic = 실사(저장 기본), wireframe = 단순보기(플레이필드 밝은 하늘색, 포인트 검은색).
 */
function drawTable(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  showGrid: boolean,
  orientation: TableOrientation = "landscape",
  drawStyle: TableDrawStyle = "realistic"
) {
  const rect = getPlayfieldRect(width, height);
  const { left, top, width: pw, height: ph } = rect;
  const isLandscape = orientation === "landscape";
  const gridLong = 8;
  const gridShort = 4;
  const playfieldCenterX = left + pw / 2;
  const playfieldCenterY = top + ph / 2;
  const frameW = width - 2 * FRAME_INSET;
  const frameH = height - 2 * FRAME_INSET;
  const pointR = 2.25;
  const pointInset = FRAME_INSET * 0.6;
  const midLong = gridLong / 2;
  const midShort = gridShort / 2;

  const isWireframe = drawStyle === "wireframe";

  if (isWireframe) {
    // 단순보기: 배경 + 테두리만, 와이어선 검은색
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, FRAME_CORNER_RADIUS);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, width, height);
    }
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(FRAME_INSET, FRAME_INSET, frameW, frameH);
    ctx.fillStyle = WIREFRAME_PLAYFIELD_FILL;
    ctx.fillRect(left, top, pw, ph);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, pw, ph);
  } else {
    // 1. 프레임 (Frame) — 실사
    const frameGrad = ctx.createLinearGradient(0, 0, width, height);
    frameGrad.addColorStop(0, "#3a3836");
    frameGrad.addColorStop(0.35, "#2c2b2a");
    frameGrad.addColorStop(0.5, "#252423");
    frameGrad.addColorStop(0.65, "#2a2928");
    frameGrad.addColorStop(1, "#363432");
    ctx.fillStyle = frameGrad;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, FRAME_CORNER_RADIUS);
      ctx.roundRect(FRAME_INSET, FRAME_INSET, frameW, frameH, CUSHION_CORNER_RADIUS);
      ctx.fill("evenodd");
    } else {
      ctx.fillRect(0, 0, width, height);
    }
    // 프레임 바깥쪽 형태선 (캔버스 가장자리)
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.5;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, FRAME_CORNER_RADIUS);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, width, height);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(1, 1, width - 2, height - 2, FRAME_CORNER_RADIUS - 1);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(FRAME_INSET, FRAME_INSET, frameW, frameH, CUSHION_CORNER_RADIUS);
      ctx.stroke();
    }

    // 2. 쿠션필드
    const cushionColor = "#2a88ab";
    ctx.fillStyle = cushionColor;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(FRAME_INSET, FRAME_INSET, frameW, frameH, CUSHION_CORNER_RADIUS);
      ctx.roundRect(left, top, pw, ph, 0);
      ctx.fill("evenodd");
    } else {
      ctx.fillRect(FRAME_INSET, FRAME_INSET, frameW, frameH);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, top, pw, ph);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, pw, ph);

    // 3. 플레이필드 + 그림자
    ctx.fillStyle = "#2a88ab";
    ctx.fillRect(left, top, pw, ph);
    const shadowDepth = 14;
    const shadowAlpha = 0.28;
    const topShadow = ctx.createLinearGradient(left, top, left, top + shadowDepth);
    topShadow.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
    topShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topShadow;
    ctx.fillRect(left, top, pw, shadowDepth);
    const bottomShadow = ctx.createLinearGradient(left, top + ph - shadowDepth, left, top + ph);
    bottomShadow.addColorStop(0, "rgba(0,0,0,0)");
    bottomShadow.addColorStop(1, `rgba(0,0,0,${shadowAlpha})`);
    ctx.fillStyle = bottomShadow;
    ctx.fillRect(left, top + ph - shadowDepth, pw, shadowDepth);
    const leftShadow = ctx.createLinearGradient(left, top, left + shadowDepth, top);
    leftShadow.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
    leftShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = leftShadow;
    ctx.fillRect(left, top, shadowDepth, ph);
    const rightShadow = ctx.createLinearGradient(left + pw - shadowDepth, top, left + pw, top);
    rightShadow.addColorStop(0, "rgba(0,0,0,0)");
    rightShadow.addColorStop(1, `rgba(0,0,0,${shadowAlpha})`);
    ctx.fillStyle = rightShadow;
    ctx.fillRect(left + pw - shadowDepth, top, shadowDepth, ph);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 1, top + 1, pw - 2, ph - 2);
  }

  // 4. 포인트 — 실사=흰색, 단순보기=검은색
  ctx.fillStyle = isWireframe ? "#000000" : "#ffffff";
  const pointPositions: { x: number; y: number }[] = [];
  for (let i = 0; i <= gridLong; i++) {
    const x = i === midLong ? playfieldCenterX : left + (pw * i) / gridLong;
    const y = isLandscape ? pointInset : (i === midLong ? playfieldCenterY : top + (ph * i) / gridLong);
    if (isLandscape) {
      pointPositions.push({ x, y });
      pointPositions.push({ x, y: height - pointInset });
    } else {
      pointPositions.push({ x: pointInset, y });
      pointPositions.push({ x: width - pointInset, y });
    }
  }
  for (let i = 0; i <= gridShort; i++) {
    const x = isLandscape ? pointInset : (i === midShort ? playfieldCenterX : left + (pw * i) / gridShort);
    const y = i === midShort ? playfieldCenterY : top + (ph * i) / gridShort;
    if (isLandscape) {
      pointPositions.push({ x, y });
      pointPositions.push({ x: width - pointInset, y });
    } else {
      pointPositions.push({ x, y: pointInset });
      pointPositions.push({ x, y: height - pointInset });
    }
  }
  pointPositions.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, pointR, 0, Math.PI * 2);
    ctx.fill();
  });

  // 5. 그리드
  if (showGrid) {
    const nDivX = isLandscape ? gridLong : gridShort;
    const nDivY = isLandscape ? gridShort : gridLong;
    const stepX = pw / nDivX;
    const stepY = ph / nDivY;
    ctx.strokeStyle = isWireframe ? "rgba(120,120,120,0.55)" : "rgba(173,216,230,0.35)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= nDivX; i++) {
      const x = left + i * stepX;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + ph);
      ctx.stroke();
    }
    for (let i = 0; i <= nDivY; i++) {
      const y = top + i * stepY;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + pw, y);
      ctx.stroke();
    }
    ctx.setLineDash([4, 4]);
    for (let k = 0; k < nDivX; k++) {
      const x = left + (k + 0.5) * stepX;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + ph);
      ctx.stroke();
    }
    for (let k = 0; k < nDivY; k++) {
      const y = top + (k + 0.5) * stepY;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + pw, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 5-2. 단순보기: 쿠션필드 그리드 — 플레이필드 긴쪽 80등분, 짧은쪽 40등분, 파란 실선 (그리드와 함께 표시)
    if (isWireframe) {
      const longDivs = 80;
      const shortDivs = 40;
      const nVert = isLandscape ? longDivs + 1 : shortDivs + 1;
      const nHorz = isLandscape ? shortDivs + 1 : longDivs + 1;
      const stepVert = isLandscape ? pw / longDivs : pw / shortDivs;
      const stepHorz = isLandscape ? ph / shortDivs : ph / longDivs;
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= nVert - 1; i++) {
        const x = left + i * stepVert;
        ctx.beginPath();
        ctx.moveTo(x, FRAME_INSET);
        ctx.lineTo(x, top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, top + ph);
        ctx.lineTo(x, height - FRAME_INSET);
        ctx.stroke();
      }
      for (let j = 0; j <= nHorz - 1; j++) {
        const y = top + j * stepHorz;
        ctx.beginPath();
        ctx.moveTo(FRAME_INSET, y);
        ctx.lineTo(left, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left + pw, y);
        ctx.lineTo(width - FRAME_INSET, y);
        ctx.stroke();
      }
    }
  }
}

/** 공배치 선택 표시: 공 중심 기준 지름 4배, 검정, opacity 20% (공 위 레이어) */
const PLACEMENT_SELECTION_RING_SCALE = 2;
const PLACEMENT_SELECTION_RING_OPACITY = 0.2;

function drawBall(
  ctx: CanvasRenderingContext2D,
  rect: PlayfieldRect,
  x: number,
  y: number,
  color: "red" | "yellow" | "white",
  isCue: boolean,
  isSelected: boolean,
  wireframe: boolean = false,
  placementMode: boolean = false
) {
  const { px, py } = normalizedToPixel(x, y, rect);
  const r = getBallRadius(getPlayfieldLongSide(rect));

  const colors: Record<typeof color, string> = {
    red: "#c41e3a",
    yellow: "#f5d033",
    white: "#f8f8f8",
  };

  if (wireframe) {
    // 단순보기: 실사화 없음, 색상 유지, 검은 외곽선
    ctx.fillStyle = colors[color];
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.stroke();
    return;
  }

  // 1. 바닥 그림자 (부드러운 타원)
  const shadowOffset = 3;
  const shadowW = r * 1.1;
  const shadowH = r * 0.4;
  const shadowGrad = ctx.createRadialGradient(
    px + shadowOffset,
    py + shadowOffset,
    0,
    px + shadowOffset,
    py + shadowOffset,
    shadowW
  );
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.35)");
  shadowGrad.addColorStop(0.5, "rgba(0,0,0,0.12)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(px + shadowOffset, py + shadowOffset, shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. 공 기본색 + 구체감
  const darken: Record<typeof color, string> = {
    red: "rgba(0,0,0,0.35)",
    yellow: "rgba(0,0,0,0.25)",
    white: "rgba(0,0,0,0.2)",
  };
  const sphereGrad = ctx.createRadialGradient(
    px - r * 0.4,
    py - r * 0.4,
    0,
    px,
    py,
    r * 1.2
  );
  sphereGrad.addColorStop(0, colors[color]);
  sphereGrad.addColorStop(0.6, colors[color]);
  sphereGrad.addColorStop(1, darken[color]);
  ctx.fillStyle = sphereGrad;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // 3. 광택 하이라이트
  const highlightGrad = ctx.createRadialGradient(
    px - r * 0.35,
    py - r * 0.35,
    0,
    px - r * 0.2,
    py - r * 0.2,
    r * 0.9
  );
  highlightGrad.addColorStop(0, "rgba(255,255,255,0.7)");
  highlightGrad.addColorStop(0.25, "rgba(255,255,255,0.25)");
  highlightGrad.addColorStop(0.6, "rgba(255,255,255,0.04)");
  highlightGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = highlightGrad;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // 4. 스펙큘러
  const specGrad = ctx.createRadialGradient(
    px - r * 0.5,
    py - r * 0.5,
    0,
    px - r * 0.5,
    py - r * 0.5,
    r * 0.4
  );
  specGrad.addColorStop(0, "rgba(255,255,255,0.9)");
  specGrad.addColorStop(0.4, "rgba(255,255,255,0.2)");
  specGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // 5. 선택된 공: 공배치 모드면 지름 4배 검정 반투명 원(20%), 아니면 이중 테두리
  if (isSelected) {
    if (placementMode) {
      const ringR = r * PLACEMENT_SELECTION_RING_SCALE;
      ctx.fillStyle = `rgba(0,0,0,${PLACEMENT_SELECTION_RING_OPACITY})`;
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

/** 수구를 둘러싼 회색 점선 원 (난구 해법 출발선 스팟용). 수구보다 크게, opacity로 깜빡임. */
function drawCueBallSpot(
  ctx: CanvasRenderingContext2D,
  rect: PlayfieldRect,
  cueNormX: number,
  cueNormY: number,
  opacity: number
) {
  const { px, py } = normalizedToPixel(cueNormX, cueNormY, rect);
  const longSide = getPlayfieldLongSide(rect);
  const ballR = getBallRadius(longSide);
  const spotR = ballR * 1.815; // 수구보다 약 10% 더 큰 원 (1.65 * 1.1)
  ctx.save();
  ctx.strokeStyle = `rgba(57,255,20,${opacity})`;
  ctx.lineWidth = Math.max(2, ballR * 0.2);
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(px, py, spotR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 1목적구 해법 출발 — 수구 스팟보다 얇은 점선·진한 파랑(경로선과 통일) */
function drawObjectBallSpot(
  ctx: CanvasRenderingContext2D,
  rect: PlayfieldRect,
  normX: number,
  normY: number,
  opacity: number
) {
  const { px, py } = normalizedToPixel(normX, normY, rect);
  const longSide = getPlayfieldLongSide(rect);
  const ballR = getBallRadius(longSide);
  const spotR = ballR * 1.815;
  ctx.save();
  ctx.strokeStyle = `rgba(29,78,216,${opacity})`;
  ctx.lineWidth = Math.max(1, ballR * 0.12);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(px, py, spotR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** 선택된 공 중심 + 좌표선 (배치 시에만, 저장 이미지 제외). 실선·붉은색·가늘게. */
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  rect: PlayfieldRect,
  centerX: number,
  centerY: number
) {
  const { px, py } = normalizedToPixel(centerX, centerY, rect);
  const { left, top, width: pw, height: ph } = rect;
  ctx.save();
  ctx.strokeStyle = "#c41e3a";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(left, py);
  ctx.lineTo(left + pw, py);
  ctx.moveTo(px, top);
  ctx.lineTo(px, top + ph);
  ctx.stroke();
  ctx.restore();
}

const BilliardTableCanvas = forwardRef<
  BilliardTableCanvasHandle,
  BilliardTableCanvasProps
>(function BilliardTableCanvas(
  {
    width: widthProp = DEFAULT_TABLE_WIDTH,
    height: heightProp = DEFAULT_TABLE_HEIGHT,
    redBall,
    yellowBall,
    whiteBall,
    cueBall,
    showGrid = false,
    selectedBall = null,
    onTableClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    interactive = true,
    paths,
    orientation = "landscape",
    drawStyle = "realistic",
    showCueBallSpot = false,
    showObjectBallSpot = false,
    objectBallSpotKey = null,
    placementMode = false,
    showCrosshairAtSelected = false,
    hideRedBall = false,
    ballNormOverrides,
    embedFill = false,
    splitBallLayer = false,
    children,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tableLayerRef = useRef<HTMLCanvasElement>(null);
  const ballLayerRef = useRef<HTMLCanvasElement>(null);
  const isPortrait = orientation === "portrait";
  const width = isPortrait ? heightProp : widthProp;
  const height = isPortrait ? widthProp : heightProp;

  const hitCanvasRef = splitBallLayer ? tableLayerRef : canvasRef;

  const drawBallsAndDecorations = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      withCrosshair: boolean = true,
      style: TableDrawStyle = drawStyle,
      cueBallSpotOpacity?: number,
      objectBallSpotOpacity?: number,
      noSelectionForExport?: boolean
    ) => {
      const isWireframe = style === "wireframe";
      const sel = noSelectionForExport ? null : selectedBall;
      const rect = getPlayfieldRect(width, height);
      const toView = (lx: number, ly: number) =>
        isPortrait ? landscapeToPortraitNorm(lx, ly) : { x: lx, y: ly };
      const redDraw = ballNormOverrides?.red ?? redBall;
      const yellowDraw = ballNormOverrides?.yellow ?? yellowBall;
      const whiteDraw = ballNormOverrides?.white ?? whiteBall;
      const rView = toView(redDraw.x, redDraw.y);
      const yView = toView(yellowDraw.x, yellowDraw.y);
      const wView = toView(whiteDraw.x, whiteDraw.y);
      if (!hideRedBall) {
        drawBall(ctx, rect, rView.x, rView.y, "red", false, sel === "red", isWireframe, placementMode);
      }
      drawBall(ctx, rect, yView.x, yView.y, "yellow", cueBall === "yellow", sel === "yellow", isWireframe, placementMode);
      drawBall(ctx, rect, wView.x, wView.y, "white", cueBall === "white", sel === "white", isWireframe, placementMode);
      if (withCrosshair && !placementMode && sel) {
        const pos =
          sel === "red" ? redDraw : sel === "yellow" ? yellowDraw : whiteDraw;
        const v = toView(pos.x, pos.y);
        drawCrosshair(ctx, rect, v.x, v.y);
      }
      if (placementMode && sel && showCrosshairAtSelected) {
        const pos =
          sel === "red" ? redDraw : sel === "yellow" ? yellowDraw : whiteDraw;
        const v = toView(pos.x, pos.y);
        drawCrosshair(ctx, rect, v.x, v.y);
      }
      if (paths?.length) {
        drawPaths(ctx, rect, paths, cueBall, whiteBall, yellowBall, isPortrait ? landscapeToPortraitNorm : undefined);
      }
      if (cueBallSpotOpacity != null && cueBallSpotOpacity > 0) {
        const cuePos = cueBall === "white" ? whiteDraw : yellowDraw;
        const cueView = toView(cuePos.x, cuePos.y);
        drawCueBallSpot(ctx, rect, cueView.x, cueView.y, cueBallSpotOpacity);
      }
      if (
        objectBallSpotOpacity != null &&
        objectBallSpotOpacity > 0 &&
        objectBallSpotKey
      ) {
        const objDraw =
          objectBallSpotKey === "red"
            ? redDraw
            : objectBallSpotKey === "yellow"
              ? yellowDraw
              : whiteDraw;
        const objView = toView(objDraw.x, objDraw.y);
        drawObjectBallSpot(ctx, rect, objView.x, objView.y, objectBallSpotOpacity);
      }
    },
    [
      width,
      height,
      isPortrait,
      redBall,
      yellowBall,
      whiteBall,
      cueBall,
      selectedBall,
      paths,
      drawStyle,
      placementMode,
      showCrosshairAtSelected,
      hideRedBall,
      ballNormOverrides,
      objectBallSpotKey,
    ]
  );

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      withGrid: boolean,
      withCrosshair: boolean = true,
      style: TableDrawStyle = drawStyle,
      cueBallSpotOpacity?: number,
      objectBallSpotOpacity?: number,
      /** true면 저장/보내기용 — 선택 링·크로스헤어 미표시 */
      noSelectionForExport?: boolean
    ) => {
      drawTable(ctx, width, height, withGrid, orientation, style);
      drawBallsAndDecorations(
        ctx,
        withCrosshair,
        style,
        cueBallSpotOpacity,
        objectBallSpotOpacity,
        noSelectionForExport
      );
    },
    [width, height, orientation, drawBallsAndDecorations]
  );

  useEffect(() => {
    if (splitBallLayer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;
    draw(ctx, showGrid, true, drawStyle, undefined, undefined, false);
  }, [splitBallLayer, draw, showGrid, drawStyle, width, height]);

  useEffect(() => {
    if (!splitBallLayer) return;
    const tCan = tableLayerRef.current;
    const bCan = ballLayerRef.current;
    if (!tCan || !bCan) return;
    const tCtx = tCan.getContext("2d");
    const bCtx = bCan.getContext("2d");
    if (!tCtx || !bCtx) return;
    tCan.width = width;
    tCan.height = height;
    bCan.width = width;
    bCan.height = height;
    drawTable(tCtx, width, height, showGrid, orientation, drawStyle);
    bCtx.clearRect(0, 0, width, height);
    drawBallsAndDecorations(bCtx, true, drawStyle, undefined, undefined, false);
  }, [splitBallLayer, width, height, showGrid, orientation, drawStyle, drawBallsAndDecorations]);

  // 수구·1목 스팟 깜빡임: showCueBallSpot / showObjectBallSpot 시에만 rAF (저장 이미지 미포함)
  useEffect(() => {
    if (!showCueBallSpot && !showObjectBallSpot) return;
    let frameId: number;
    if (splitBallLayer) {
      const bCan = ballLayerRef.current;
      if (!bCan) return;
      const bCtx = bCan.getContext("2d");
      if (!bCtx) return;
      const tick = () => {
        const t = Date.now() / 180;
        const opacity = Math.sin(t) >= 0 ? 1 : 0;
        bCtx.clearRect(0, 0, width, height);
        drawBallsAndDecorations(
          bCtx,
          true,
          drawStyle,
          showCueBallSpot ? opacity : undefined,
          showObjectBallSpot ? opacity : undefined,
          false
        );
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(frameId);
        bCtx.clearRect(0, 0, width, height);
        drawBallsAndDecorations(bCtx, true, drawStyle, undefined, undefined, false);
      };
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tickSingle = () => {
      const t = Date.now() / 180;
      const opacity = Math.sin(t) >= 0 ? 1 : 0;
      draw(
        ctx,
        showGrid,
        true,
        drawStyle,
        showCueBallSpot ? opacity : undefined,
        showObjectBallSpot ? opacity : undefined,
        false
      );
      frameId = requestAnimationFrame(tickSingle);
    };
    frameId = requestAnimationFrame(tickSingle);
    return () => {
      cancelAnimationFrame(frameId);
      draw(ctx, showGrid, true, drawStyle, undefined, undefined, false);
    };
  }, [
    showCueBallSpot,
    showObjectBallSpot,
    splitBallLayer,
    draw,
    drawBallsAndDecorations,
    showGrid,
    drawStyle,
    width,
    height,
  ]);

  useImperativeHandle(ref, () => ({
    getDataURL(includeGrid: boolean, forceLandscape?: boolean, forceStyle?: TableDrawStyle) {
      const styleToUse = forceStyle ?? drawStyle;

      if (forceLandscape && isPortrait) {
        const w = DEFAULT_TABLE_WIDTH;
        const h = DEFAULT_TABLE_HEIGHT;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const offCtx = off.getContext("2d");
        if (!offCtx) return "";
        drawTable(offCtx, w, h, includeGrid, "landscape", styleToUse);
        const rect = getPlayfieldRect(w, h);
        const wf = styleToUse === "wireframe";
        drawBall(offCtx, rect, redBall.x, redBall.y, "red", false, false, wf, false);
        drawBall(offCtx, rect, yellowBall.x, yellowBall.y, "yellow", cueBall === "yellow", false, wf, false);
        drawBall(offCtx, rect, whiteBall.x, whiteBall.y, "white", cueBall === "white", false, wf, false);
        if (paths?.length) {
          drawPaths(offCtx, rect, paths, cueBall, whiteBall, yellowBall, undefined);
        }
        return off.toDataURL("image/png");
      }

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) return "";
      draw(ctx, includeGrid, false, styleToUse, undefined, undefined, true);
      return exportCanvas.toDataURL("image/png");
    },
  }));

  const playfield = getPlayfieldRect(width, height);

  function getNormalizedFromEvent(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = hitCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    if (
      px >= playfield.left &&
      px <= playfield.left + playfield.width &&
      py >= playfield.top &&
      py <= playfield.top + playfield.height
    ) {
      return {
        x: (px - playfield.left) / playfield.width,
        y: (py - playfield.top) / playfield.height,
      };
    }
    return null;
  }

  const toLandscapeNorm = (viewNorm: { x: number; y: number }) =>
    isPortrait ? portraitToLandscapeNorm(viewNorm.x, viewNorm.y) : viewNorm;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = hitCanvasRef.current;
    if (!canvas) return;
    const norm = getNormalizedFromEvent(e.clientX, e.clientY);
    if (norm) {
      onPointerDown?.(toLandscapeNorm(norm));
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !onPointerMove) return;
    const norm = getNormalizedFromEvent(e.clientX, e.clientY);
    if (norm) onPointerMove(toLandscapeNorm(norm));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = hitCanvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
    onPointerUp?.();
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onTableClick || !interactive) return;
    const norm = getNormalizedFromEvent(e.clientX, e.clientY);
    if (norm) onTableClick(toLandscapeNorm(norm));
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!onTableClick || !interactive) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const norm = getNormalizedFromEvent(touch.clientX, touch.clientY);
    if (norm) onTableClick(toLandscapeNorm(norm));
  };

  const usePointerDrag = Boolean(onPointerDown ?? onPointerMove ?? onPointerUp);

  // 테이블 긴쪽 기준으로 화면에 전부 나오게: 너비·높이 모두 컨테이너 및 뷰포트 안에 맞춤
  const fitStyle: React.CSSProperties = embedFill
    ? { width: "100%", height: "100%", display: "block" as const }
    : {
        width: `min(100%, 100dvh * ${width}/${height})`,
        height: `min(100%, 100vw * ${height}/${width})`,
        aspectRatio: `${width} / ${height}`,
      };

  const canvasCommonStyle: React.CSSProperties = {
    cursor: interactive ? "crosshair" : "default",
    objectFit: embedFill ? "fill" : "contain",
  };

  if (splitBallLayer) {
    return (
      <div className="relative max-w-full max-h-full" style={fitStyle}>
        <canvas
          ref={tableLayerRef}
          width={width}
          height={height}
          className="absolute inset-0 z-0 h-full w-full touch-none block"
          style={canvasCommonStyle}
          onClick={!usePointerDrag ? handleClick : undefined}
          onTouchEnd={!usePointerDrag ? handleTouchEnd : undefined}
          onPointerDown={usePointerDrag ? handlePointerDown : undefined}
          onPointerMove={usePointerDrag ? handlePointerMove : undefined}
          onPointerUp={usePointerDrag ? handlePointerUp : undefined}
          onPointerCancel={usePointerDrag ? handlePointerUp : undefined}
          aria-label="당구대"
        />
        <div className="pointer-events-none absolute inset-0 z-[5] min-h-0 min-w-0">{children}</div>
        <canvas
          ref={ballLayerRef}
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full touch-none block"
          style={{ objectFit: embedFill ? "fill" : "contain" }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="max-w-full max-h-full" style={fitStyle}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full touch-none block"
        style={{
          cursor: interactive ? "crosshair" : "default",
          /** embedFill: 부모가 캔버스 비율과 동일 — 꽉 채워 object-fit 여백 없이 히트 좌표와 줌 셀 일치 */
          objectFit: embedFill ? "fill" : "contain",
        }}
        onClick={!usePointerDrag ? handleClick : undefined}
        onTouchEnd={!usePointerDrag ? handleTouchEnd : undefined}
        onPointerDown={usePointerDrag ? handlePointerDown : undefined}
        onPointerMove={usePointerDrag ? handlePointerMove : undefined}
        onPointerUp={usePointerDrag ? handlePointerUp : undefined}
        onPointerCancel={usePointerDrag ? handlePointerUp : undefined}
        aria-label="당구대"
      />
    </div>
  );
});

export default BilliardTableCanvas;
