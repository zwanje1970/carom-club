"use client";

/**
 * 공통 당구대 편집기
 * - 당구노트, 난구풀이, 해법 작성에서 동일한 편집기를 재사용합니다.
 * - mode: ball(공 배치) / path(경로 편집). 두 모드가 섞이지 않음.
 */
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import BilliardTableCanvas, {
  type BallPositions,
  type BilliardTableCanvasHandle,
} from "./BilliardTableCanvas";
import { BilliardPathLayer } from "./BilliardPathLayer";
import {
  clampBallToPlayfield,
  clampBallToPlayfieldAndNoOverlap,
  getDragPositionIfValid,
  hitTestBall,
  getPlayfieldRect,
  normalizedToPixel,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  type BallColor,
  type CueBallType,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import type { BilliardPath } from "@/lib/billiard-path-types";

const defaultPositions: BallPositions = {
  red: { x: 0.25, y: 0.5 },
  yellow: { x: 0.5, y: 0.5 },
  white: { x: 0.75, y: 0.5 },
};

const MAX_PATH_POINTS = 11;

export type BilliardEditorMode = "ball" | "path";

export interface BilliardTableEditorSnapshot {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
  paths?: BilliardPath[];
}

export interface BilliardTableEditorHandle {
  getDataURL: (includeGrid: boolean, forceLandscape?: boolean) => string;
  getSnapshot: () => BilliardTableEditorSnapshot;
}

export interface BilliardTableEditorProps {
  initialRed?: { x: number; y: number };
  initialYellow?: { x: number; y: number };
  initialWhite?: { x: number; y: number };
  initialCueBall?: CueBallType;
  initialPaths?: BilliardPath[];
  showGrid?: boolean;
  interactive?: boolean;
  /** ball = 공 배치만, path = 경로만. 기본 ball (당구노트 호환) */
  defaultMode?: BilliardEditorMode;
  /** 편집기 아래에 렌더할 추가 UI (예: 메모, 저장 버튼) */
  children?: React.ReactNode;
  /** 모바일 전체화면: 캔버스만 표시, 툴바/수구 선택 UI 숨김 */
  canvasOnly?: boolean;
  /** 캔버스 방향 (제어 모드). 미지정 시 내부 state 사용 */
  orientation?: TableOrientation;
  /** 수구 (제어 모드). 미지정 시 내부 state 사용 */
  cueBall?: CueBallType;
  /** 그리드 ON/OFF (제어 모드). canvasOnly 시 상단 메뉴에서 제어할 때 사용 */
  gridOn?: boolean;
  onGridChange?: (value: boolean) => void;
  /** 실사보기/단순보기 (제어 모드) */
  drawStyle?: "realistic" | "wireframe";
  onDrawStyleChange?: (value: "realistic" | "wireframe") => void;
  /** 난구 공배치 전용: 위치만, 터치 1.5배, 선택 반투명 링, 상단 안내, 경로 모드 비노출 */
  placementMode?: boolean;
}

const BilliardTableEditor = forwardRef<
  BilliardTableEditorHandle,
  BilliardTableEditorProps
>(function BilliardTableEditor(
  {
    initialRed,
    initialYellow,
    initialWhite,
    initialCueBall = "white",
    initialPaths = [],
    showGrid = true,
    interactive = true,
    defaultMode = "ball",
    children,
    canvasOnly = false,
    orientation: orientationProp,
    cueBall: cueBallProp,
    gridOn: gridOnProp,
    onGridChange,
    drawStyle: drawStyleProp,
    onDrawStyleChange,
    placementMode = false,
  },
  ref
) {
  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

  const [mode, setMode] = useState<BilliardEditorMode>(defaultMode);
  const [redBall, setRedBall] = useState(() => {
    const p = initialRed ?? defaultPositions.red;
    return clampBallToPlayfield(p.x, p.y, rect);
  });
  const [yellowBall, setYellowBall] = useState(() => {
    const p = initialYellow ?? defaultPositions.yellow;
    return clampBallToPlayfield(p.x, p.y, rect);
  });
  const [whiteBall, setWhiteBall] = useState(() => {
    const p = initialWhite ?? defaultPositions.white;
    return clampBallToPlayfield(p.x, p.y, rect);
  });
  const [cueBall, setCueBall] = useState<CueBallType>(initialCueBall);
  const [selectedBall, setSelectedBall] = useState<BallColor | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [paths, setPaths] = useState<BilliardPath[]>(initialPaths);
  const [nextClickStartsFreePath, setNextClickStartsFreePath] = useState(false);
  const [orientation, setOrientation] = useState<TableOrientation>("landscape");
  const [gridOnInternal, setGridOnInternal] = useState(showGrid);
  const [tableDrawStyleInternal, setTableDrawStyleInternal] = useState<"realistic" | "wireframe">("realistic");
  const tableRef = useRef<BilliardTableCanvasHandle>(null);
  const fineTuneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const FINE_STEP = 0.002; // 1회 클릭/연속 이동 시 normalized 이동량 (약 1~2px 수준)
  const [lastDragEndTime, setLastDragEndTime] = useState<number | null>(null);
  const [isFineTuning, setIsFineTuning] = useState(false);

  const gridOn = gridOnProp ?? gridOnInternal;
  const setGridOn = (v: boolean) => {
    if (onGridChange) onGridChange(v);
    else setGridOnInternal(v);
  };
  const tableDrawStyle = drawStyleProp ?? tableDrawStyleInternal;
  const setTableDrawStyle = (v: "realistic" | "wireframe") => {
    if (onDrawStyleChange) onDrawStyleChange(v);
    else setTableDrawStyleInternal(v);
  };

  const effectiveOrientation = orientationProp ?? orientation;
  const effectiveCueBall = cueBallProp ?? cueBall;

  const handlePointerDownBall = (normalized: { x: number; y: number }) => {
    const { px, py } = normalizedToPixel(normalized.x, normalized.y, rect);
    const hit = hitTestBall(px, py, redBall, yellowBall, whiteBall, rect, placementMode ? 1.5 : 1);
    if (hit) {
      if (hit !== selectedBall) setLastDragEndTime(null);
      setSelectedBall(hit);
      setIsDragging(true);
    } else {
      setSelectedBall(null);
    }
  };

  const handlePointerMoveBall = (normalized: { x: number; y: number }) => {
    if (!isDragging || !selectedBall) return;
    const next = getDragPositionIfValid(
      normalized.x,
      normalized.y,
      selectedBall,
      redBall,
      yellowBall,
      whiteBall,
      rect
    );
    if (next == null) return;
    if (selectedBall === "red") setRedBall(next);
    if (selectedBall === "yellow") setYellowBall(next);
    if (selectedBall === "white") setWhiteBall(next);
  };

  const handlePointerUpBall = () => {
    if (isDragging && selectedBall) setLastDragEndTime(Date.now());
    setIsDragging(false);
  };

  const moveSelectedBall = useCallback(
    (dx: number, dy: number) => {
      if (!selectedBall) return;
      const next = getDragPositionIfValid(
        (selectedBall === "red" ? redBall.x : selectedBall === "yellow" ? yellowBall.x : whiteBall.x) + dx,
        (selectedBall === "red" ? redBall.y : selectedBall === "yellow" ? yellowBall.y : whiteBall.y) + dy,
        selectedBall,
        redBall,
        yellowBall,
        whiteBall,
        rect
      );
      if (next == null) return;
      if (selectedBall === "red") setRedBall(next);
      if (selectedBall === "yellow") setYellowBall(next);
      if (selectedBall === "white") setWhiteBall(next);
    },
    [selectedBall, redBall, yellowBall, whiteBall, rect]
  );

  const clearFineTuneInterval = useCallback(() => {
    if (fineTuneIntervalRef.current) {
      clearInterval(fineTuneIntervalRef.current);
      fineTuneIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearFineTuneInterval(), [clearFineTuneInterval]);

  const startFineTune = useCallback(
    (dx: number, dy: number) => {
      setLastDragEndTime(null);
      setIsFineTuning(true);
      moveSelectedBall(dx, dy); // 1회 클릭 시 즉시 1스텝 이동
      fineTuneIntervalRef.current = setInterval(() => moveSelectedBall(dx, dy), 120); // 길게 누름: 연속 이동
    },
    [moveSelectedBall]
  );

  const handleFineTuneEnd = useCallback(() => {
    clearFineTuneInterval();
    setIsFineTuning(false);
    if (selectedBall) setLastDragEndTime(Date.now());
  }, [clearFineTuneInterval, selectedBall]);

  const showPlus =
    placementMode &&
    selectedBall &&
    (isDragging ||
      isFineTuning ||
      (lastDragEndTime !== null && Date.now() - lastDragEndTime < 3000));

  useEffect(() => {
    if (!placementMode || !selectedBall || isFineTuning) return;
    if (lastDragEndTime === null) return;
    const t = setTimeout(() => setLastDragEndTime(null), 3000);
    return () => clearTimeout(t);
  }, [placementMode, selectedBall, isFineTuning, lastDragEndTime]);

  // 회전 후 검사: 공 겹침·플레이필드 이탈 방지
  useEffect(() => {
    const clampedRed = clampBallToPlayfieldAndNoOverlap(
      redBall.x, redBall.y, "red", redBall, yellowBall, whiteBall, rect
    );
    const clampedYellow = clampBallToPlayfieldAndNoOverlap(
      yellowBall.x, yellowBall.y, "yellow", redBall, yellowBall, whiteBall, rect
    );
    const clampedWhite = clampBallToPlayfieldAndNoOverlap(
      whiteBall.x, whiteBall.y, "white", redBall, yellowBall, whiteBall, rect
    );
    if (
      clampedRed.x !== redBall.x || clampedRed.y !== redBall.y ||
      clampedYellow.x !== yellowBall.x || clampedYellow.y !== yellowBall.y ||
      clampedWhite.x !== whiteBall.x || clampedWhite.y !== whiteBall.y
    ) {
      setRedBall(clampedRed);
      setYellowBall(clampedYellow);
      setWhiteBall(clampedWhite);
    }
  }, [effectiveOrientation]);

  const handlePathCueBallClick = () => {
    setPaths((prev) => [...prev, { start: { type: "cueBall" }, points: [] }]);
  };

  const handlePathTableClick = (normalized: { x: number; y: number }) => {
    if (nextClickStartsFreePath) {
      setPaths((prev) => [
        ...prev,
        { start: { type: "free", x: normalized.x, y: normalized.y }, points: [] },
      ]);
      setNextClickStartsFreePath(false);
      return;
    }
    const last = paths[paths.length - 1];
    if (!last || last.points.length >= MAX_PATH_POINTS) return;
    setPaths((prev) => {
      const p = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        { ...p, points: [...p.points, normalized] },
      ];
    });
  };

  const handleSpotDrag = (
    pathIndex: number,
    pointIndex: number,
    normalized: { x: number; y: number }
  ) => {
    setPaths((prev) => {
      const path = prev[pathIndex];
      if (!path) return prev;
      if (pointIndex === -1) {
        if (path.start.type !== "free") return prev;
        return [
          ...prev.slice(0, pathIndex),
          { ...path, start: { type: "free", x: normalized.x, y: normalized.y } },
          ...prev.slice(pathIndex + 1),
        ];
      }
      const next = [...path.points];
      if (pointIndex < 0 || pointIndex >= next.length) return prev;
      next[pointIndex] = normalized;
      return [
        ...prev.slice(0, pathIndex),
        { ...path, points: next },
        ...prev.slice(pathIndex + 1),
      ];
    });
  };

  const removeLastPoint = () => {
    setPaths((prev) => {
      const last = prev[prev.length - 1];
      if (!last?.points.length) return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, points: last.points.slice(0, -1) },
      ];
    });
  };

  const clearAllPaths = () => setPaths([]);

  const isBallMode = mode === "ball";
  const tableInteractive = interactive && (isBallMode ? true : false);

  useImperativeHandle(ref, () => ({
    getDataURL(includeGrid: boolean, forceLandscape?: boolean) {
      return tableRef.current?.getDataURL(includeGrid, forceLandscape, "realistic") ?? "";
    },
    getSnapshot(): BilliardTableEditorSnapshot {
      return {
        redBall,
        yellowBall,
        whiteBall,
        cueBall: effectiveCueBall,
        paths: paths.length ? paths : undefined,
      };
    },
  }));

  const placementHintLabel =
    placementMode && isDragging && selectedBall
      ? selectedBall === "red"
        ? "🔴공 이동"
        : selectedBall === "yellow"
          ? "🟡공 이동"
          : "⚪공 이동"
      : null;

  const selectedPos =
    placementMode && selectedBall
      ? selectedBall === "red"
        ? redBall
        : selectedBall === "yellow"
          ? yellowBall
          : whiteBall
      : null;
  const coordText =
    placementMode && selectedBall && selectedPos
      ? `X:${selectedPos.x.toFixed(3)} Y:${selectedPos.y.toFixed(3)}`
      : null;
  const showCoordBar = placementMode && (isDragging || isFineTuning) && coordText;

  const canvasBlock = (
    <div className="flex justify-center items-center rounded-lg p-2 overflow-x-auto flex-1 min-h-0">
      {placementHintLabel && (
        <div
          className="fixed left-1/2 top-6 z-50 -translate-x-1/2 text-[15px] font-bold text-site-text bg-transparent"
          style={{ pointerEvents: "none" }}
          aria-live="polite"
        >
          {placementHintLabel}
        </div>
      )}
      {showCoordBar && (
        <div
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center bg-black py-2 text-[13px] font-bold tabular-nums"
          style={{
            pointerEvents: "none",
            color: "#00ff41",
            fontFamily: "ui-monospace, monospace",
            textShadow: "0 0 4px #00ff41",
          }}
          aria-live="polite"
        >
          {coordText}
        </div>
      )}
      <div className="relative w-full h-full max-h-full flex items-center justify-center min-w-0">
        <BilliardTableCanvas
          ref={tableRef}
          width={DEFAULT_TABLE_WIDTH}
          height={DEFAULT_TABLE_HEIGHT}
          redBall={redBall}
          yellowBall={yellowBall}
          whiteBall={whiteBall}
          cueBall={effectiveCueBall}
          showGrid={gridOn}
          selectedBall={isBallMode ? selectedBall : null}
          onPointerDown={isBallMode ? handlePointerDownBall : undefined}
          onPointerMove={isBallMode ? handlePointerMoveBall : undefined}
          onPointerUp={isBallMode ? handlePointerUpBall : undefined}
          interactive={tableInteractive}
          paths={paths}
          orientation={effectiveOrientation}
          drawStyle={tableDrawStyle}
          showCueBallSpot={placementMode ? false : isBallMode ? !isDragging : true}
          placementMode={placementMode}
          showCrosshairAtSelected={showPlus}
        />
        {placementMode && showPlus && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            style={{ pointerEvents: "auto" }}
            aria-label="미세조정 (4방향)"
          >
            <div className="grid grid-cols-3 gap-4 items-center justify-center w-max">
              <span className="w-14 h-14" aria-hidden />
              <button
                type="button"
                aria-label="위로 미세 이동"
                className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full font-bold text-white bg-black/25 active:bg-black/45 transition-colors"
                onPointerDown={() => startFineTune(0, -FINE_STEP)}
                onPointerUp={handleFineTuneEnd}
                onPointerLeave={handleFineTuneEnd}
                onPointerCancel={handleFineTuneEnd}
              >
                ▲
              </button>
              <span className="w-14 h-14" aria-hidden />
              <button
                type="button"
                aria-label="왼쪽으로 미세 이동"
                className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full font-bold text-white bg-black/25 active:bg-black/45 transition-colors"
                onPointerDown={() => startFineTune(-FINE_STEP, 0)}
                onPointerUp={handleFineTuneEnd}
                onPointerLeave={handleFineTuneEnd}
                onPointerCancel={handleFineTuneEnd}
              >
                ◀
              </button>
              <span className="w-14 h-14" aria-hidden />
              <button
                type="button"
                aria-label="오른쪽으로 미세 이동"
                className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full font-bold text-white bg-black/25 active:bg-black/45 transition-colors"
                onPointerDown={() => startFineTune(FINE_STEP, 0)}
                onPointerUp={handleFineTuneEnd}
                onPointerLeave={handleFineTuneEnd}
                onPointerCancel={handleFineTuneEnd}
              >
                ▶
              </button>
              <span className="w-14 h-14" aria-hidden />
              <button
                type="button"
                aria-label="아래로 미세 이동"
                className="w-14 h-14 min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full font-bold text-white bg-black/25 active:bg-black/45 transition-colors"
                onPointerDown={() => startFineTune(0, FINE_STEP)}
                onPointerUp={handleFineTuneEnd}
                onPointerLeave={handleFineTuneEnd}
                onPointerCancel={handleFineTuneEnd}
              >
                ▼
              </button>
              <span className="w-14 h-14" aria-hidden />
            </div>
          </div>
        )}
        {mode === "path" && (
          <BilliardPathLayer
            width={effectiveOrientation === "portrait" ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH}
            height={effectiveOrientation === "portrait" ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT}
            paths={paths}
            cueBall={effectiveCueBall}
            whiteBall={whiteBall}
            yellowBall={yellowBall}
            orientation={effectiveOrientation}
            onTableClick={handlePathTableClick}
            onCueBallClick={handlePathCueBallClick}
            onSpotDrag={handleSpotDrag}
          />
        )}
      </div>
    </div>
  );

  if (canvasOnly) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center min-h-0">
        {canvasBlock}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 모드 전환 + 경로 툴바 (placementMode면 공배치만, 경로 비노출) */}
      {!placementMode && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400 mr-1">모드:</span>
        <button
          type="button"
          onClick={() => setMode("ball")}
          className={`px-3 py-1.5 rounded border text-sm font-medium ${
            mode === "ball"
              ? "bg-site-primary text-white border-site-primary"
              : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
          }`}
        >
          공 배치
        </button>
        <button
          type="button"
          onClick={() => setMode("path")}
          className={`px-3 py-1.5 rounded border text-sm font-medium ${
            mode === "path"
              ? "bg-site-primary text-white border-site-primary"
              : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
          }`}
        >
          경로
        </button>
        {mode === "path" && (
          <>
            <button
              type="button"
              onClick={() => setNextClickStartsFreePath(true)}
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm"
            >
              선 추가
            </button>
            <button
              type="button"
              onClick={removeLastPoint}
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm"
            >
              마지막 점 삭제
            </button>
            <button
              type="button"
              onClick={clearAllPaths}
              className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm"
            >
              전체 경로 삭제
            </button>
          </>
        )}
      </div>
      )}

      {mode === "ball" && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {placementMode
            ? "공을 드래그해 위치를 설정하세요."
            : "테이블 위 공을 클릭해 선택한 뒤 드래그로 이동합니다. 공은 서로 겹치지 않으며 플레이필드 안에서만 움직입니다."}
        </p>
      )}

      {mode === "path" && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          수구를 클릭하면 수구에서 경로 시작. &quot;선 추가&quot; 후 테이블 클릭하면 해당 위치에서 시작. 테이블 클릭으로 스팟 추가(최대 {MAX_PATH_POINTS}개). 스팟 드래그로 이동.
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>당구대 방향:</span>
          <button
            type="button"
            onClick={() => setOrientation("landscape")}
            className={`px-2 py-1 rounded border ${
              orientation === "landscape"
                ? "bg-site-primary text-white border-site-primary"
                : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
            }`}
          >
            가로형
          </button>
          <button
            type="button"
            onClick={() => setOrientation("portrait")}
            className={`px-2 py-1 rounded border ${
              orientation === "portrait"
                ? "bg-site-primary text-white border-site-primary"
                : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
            }`}
          >
            세로형
          </button>
          <span className="ml-2 border-l border-gray-300 dark:border-slate-600 pl-2">그리드:</span>
          <button
            type="button"
            onClick={() => setGridOn(!gridOn)}
            className={`px-2 py-1 rounded border ${
              gridOn
                ? "bg-site-primary text-white border-site-primary"
                : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
            }`}
          >
            {gridOn ? "ON" : "OFF"}
          </button>
          <span className="ml-2 border-l border-gray-300 dark:border-slate-600 pl-2">보기:</span>
          <button
            type="button"
            onClick={() => setTableDrawStyle("realistic")}
            className={`px-2 py-1 rounded border ${
              tableDrawStyle === "realistic"
                ? "bg-site-primary text-white border-site-primary"
                : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
            }`}
          >
            실사보기
          </button>
          <button
            type="button"
            onClick={() => setTableDrawStyle("wireframe")}
            className={`px-2 py-1 rounded border ${
              tableDrawStyle === "wireframe"
                ? "bg-site-primary text-white border-site-primary"
                : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600"
            }`}
          >
            단순보기
          </button>
        </div>
        {canvasBlock}
      </div>

      {!canvasOnly && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            수구
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cueBall"
                checked={effectiveCueBall === "white"}
                onChange={() => setCueBall("white")}
                className="rounded-full border-gray-300"
              />
              <span>흰공</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cueBall"
                checked={effectiveCueBall === "yellow"}
                onChange={() => setCueBall("yellow")}
                className="rounded-full border-gray-300"
              />
              <span>노란공</span>
            </label>
          </div>
        </div>
      )}

      {children}
    </div>
  );
});

export default BilliardTableEditor;
