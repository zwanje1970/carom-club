"use client";

/**
 * 난구해결(trouble) 전용 해법 편집기.
 * - 원본: layoutImageUrl(이미지) 또는 ballPlacement(좌표) 읽기 전용
 * - 해법: 두께·당점·백스트로크·팔로우·볼스피드·진행경로·해설
 * - 저장: content(해설) + solutionData(JSON)
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  getPlayfieldRect,
  pixelToNormalized,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import type { NanguPathPoint } from "@/lib/nangu-types";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import { NanguThicknessEditor, getThicknessOverlap } from "@/components/nangu/NanguThicknessEditor";
import { NanguSpinEditor } from "@/components/nangu/NanguSpinEditor";
import { NanguFocusZoomOverlay, type NanguFocusZoomTarget } from "@/components/nangu/NanguFocusZoomOverlay";
import { sanitizeImageSrc } from "@/lib/image-src";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";
import { cueObjectCollisionNormalized } from "@/lib/solution-path-geometry";
import type { CushionSnapFn } from "@/lib/cue-path-cushion-rules";
import {
  appendCuePathSpot,
  insertCuePathSpot,
  moveCuePathSpotById,
  stripInvalidEndSpots,
} from "@/lib/cue-path-cushion-rules";
import {
  BALL_SPEED_OPTIONS,
  ballSpeedToLegacySpeed,
  ballSpeedToLegacySpeedLevel,
  ballSpeedToRailCount,
  getRailDisplayPowerForBallSpeed,
  type BallSpeed,
} from "@/lib/ball-speed-constants";
import { useTroublePathPlayback } from "@/hooks/useTroublePathPlayback";
import { CollisionWarningToast } from "@/components/trouble/CollisionWarningToast";

export type TroubleActivePanel =
  | "thickness"
  | "spin"
  | "backstroke"
  | "followstroke"
  | "speed"
  | "path";

export interface TroubleSolutionEditorProps {
  /** 이미지만 있을 때 사용. ballPlacement 있으면 무시 가능 */
  layoutImageUrl: string | null;
  /** 좌표 기반 배치 (있으면 읽기 전용 테이블 렌더, 없으면 이미지 표시) */
  ballPlacement: NanguBallPlacement | null;
  postTitle: string;
  postContent: string;
  onSubmit: (payload: { content: string; solutionData: NanguSolutionData }) => Promise<void>;
}

/** PC에서 배치도 폭 확대 (중심 콘텐츠) */
const LAYOUT_PLACEMENT_MAX_WIDTH = 960;

export function TroubleSolutionEditor({
  layoutImageUrl,
  ballPlacement,
  postTitle,
  postContent,
  onSubmit,
}: TroubleSolutionEditorProps) {
  const [activePanel, setActivePanel] = useState<TroubleActivePanel>("thickness");
  const [isBankShot, setIsBankShot] = useState(false);
  const [thicknessOffsetX, setThicknessOffsetX] = useState(0.5);
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);
  const [backstrokeLevel, setBackstrokeLevel] = useState(5);
  const [followStrokeLevel, setFollowStrokeLevel] = useState(5);
  const [ballSpeed, setBallSpeed] = useState<BallSpeed>(3.0);
  const [pathMode, setPathMode] = useState(false);
  const [objectPathMode, setObjectPathMode] = useState(false);
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>([]);
  const [objectPathPoints, setObjectPathPoints] = useState<NanguPathPoint[]>([]);
  /** 1목 경로 미입력 상태에서 시연 시 red 공 숨김 */
  const [pathRuleHint, setPathRuleHint] = useState("");
  const [explanationText, setExplanationText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [focusZoom, setFocusZoom] = useState<{
    active: boolean;
    target: NanguFocusZoomTarget;
    originX: number;
    originY: number;
  }>({ active: false, target: null, originX: 0, originY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

  const cuePos = ballPlacement
    ? ballPlacement.cueBall === "yellow"
      ? ballPlacement.yellowBall
      : ballPlacement.whiteBall
    : { x: 0.5, y: 0.5 };

  const objectBallNorm = ballPlacement?.redBall ?? null;

  const collisionNorm = useMemo(() => {
    if (!objectBallNorm || pathPoints.length < 1) return null;
    return cueObjectCollisionNormalized(cuePos, pathPoints[0], objectBallNorm, rect);
  }, [objectBallNorm, pathPoints, cuePos, rect]);

  const getNormalizedFromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = containerRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const scaleX = DEFAULT_TABLE_WIDTH / r.width;
      const scaleY = DEFAULT_TABLE_HEIGHT / r.height;
      const px = (clientX - r.left) * scaleX;
      const py = (clientY - r.top) * scaleY;
      if (
        px >= rect.left &&
        px <= rect.left + rect.width &&
        py >= rect.top &&
        py <= rect.top + rect.height
      ) {
        return pixelToNormalized(px, py, rect);
      }
      return null;
    },
    [rect.left, rect.top, rect.width, rect.height]
  );

  const snapToCushionIfNear = useCallback((x: number, y: number): { x: number; y: number; type: "ball" | "cushion" | "free" } => {
    const margin = 0.04;
    let nx = x, ny = y;
    let onEdge = false;
    if (x <= margin) { nx = 0; onEdge = true; } else if (x >= 1 - margin) { nx = 1; onEdge = true; }
    if (y <= margin) { ny = 0; onEdge = true; } else if (y >= 1 - margin) { ny = 1; onEdge = true; }
    return { x: nx, y: ny, type: onEdge ? "cushion" : "free" };
  }, []);

  const cushionSnapFn: CushionSnapFn = useCallback(
    (x: number, y: number) => {
      const r = snapToCushionIfNear(x, y);
      return { x: r.x, y: r.y, type: r.type === "cushion" ? "cushion" : "free" };
    },
    [snapToCushionIfNear]
  );

  const newCueSpotId = useCallback(
    () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const runCueAppend = useCallback(
    (norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        const r = appendCuePathSpot(prev, norm, cushionSnapFn, newCueSpotId);
        if (!r.ok) {
          queueMicrotask(() => setPathRuleHint(r.message));
          return prev;
        }
        queueMicrotask(() => setPathRuleHint(""));
        return r.points;
      });
    },
    [cushionSnapFn, newCueSpotId]
  );

  const clearPathPoints = useCallback(() => {
    setPathPoints([]);
    setObjectPathPoints([]);
  }, []);

  const addObjectPathPoint = useCallback(
    (norm: { x: number; y: number }, type?: "ball" | "cushion" | "free") => {
      const snapped =
        type != null ? { x: norm.x, y: norm.y, type } : snapToCushionIfNear(norm.x, norm.y);
      setObjectPathPoints((prev) => [
        ...prev,
        { id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, x: snapped.x, y: snapped.y, type: snapped.type },
      ]);
    },
    [snapToCushionIfNear]
  );

  const clearObjectPathPoints = useCallback(() => setObjectPathPoints([]), []);

  const moveObjectPathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      const snapped = snapToCushionIfNear(norm.x, norm.y);
      setObjectPathPoints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, x: snapped.x, y: snapped.y, type: snapped.type } : p))
      );
    },
    [snapToCushionIfNear]
  );

  const removeObjectPathPoint = useCallback((id: string) => {
    setObjectPathPoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const insertObjectPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      const snapped = snapToCushionIfNear(norm.x, norm.y);
      const newPoint: NanguPathPoint = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: snapped.x,
        y: snapped.y,
        type: snapped.type,
      };
      setObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        return next;
      });
    },
    [snapToCushionIfNear]
  );

  const pathPlayback = useTroublePathPlayback({
    ballPlacement,
    pathPoints,
    objectPathPoints,
    ballSpeed,
    isBankShot,
    thicknessOffsetX,
  });

  useEffect(() => {
    if (pathPoints.length === 0) {
      setObjectPathPoints([]);
      setObjectPathMode(false);
    }
  }, [pathPoints.length]);

  const movePathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setPathPoints((prev) => moveCuePathSpotById(prev, id, norm, cushionSnapFn));
    },
    [cushionSnapFn]
  );

  const removePathPoint = useCallback((id: string) => {
    setPathPoints((prev) => stripInvalidEndSpots(prev.filter((p) => p.id !== id)));
  }, []);

  const insertPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        const r = insertCuePathSpot(prev, segmentIndex, norm, cushionSnapFn, newCueSpotId);
        if (!r.ok) {
          queueMicrotask(() => setPathRuleHint(r.message));
          return prev;
        }
        queueMicrotask(() => setPathRuleHint(""));
        return r.points;
      });
    },
    [cushionSnapFn, newCueSpotId]
  );

  const handleTableClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pathMode) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      const dupThreshold = 0.03;
      const isDup = pathPoints.length > 0 && pathPoints.some((p) => Math.hypot(p.x - norm.x, p.y - norm.y) < dupThreshold);
      if (isDup) return;
      runCueAppend(norm);
    },
    [pathMode, getNormalizedFromEvent, runCueAppend, pathPoints]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath = pathPoints.length >= 1 ? pathPoints.map((p) => ({ x: p.x, y: p.y })) : [];
      let reflectionPath: NanguSolutionData["reflectionPath"];
      if (collisionNorm && objectPathPoints.length >= 1) {
        const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
        reflectionPath = {
          points: [{ x: collisionNorm.x, y: collisionNorm.y }, ...objPts],
          pointsWithType: objectPathPoints,
        };
      }

      const solutionData: NanguSolutionData = {
        isBankShot,
        thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
        tipX: spinX,
        tipY: spinY,
        spinX,
        spinY,
        paths: pointsForPath.length >= 2 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
        reflectionPath,
        backstrokeLevel,
        followStrokeLevel,
        ballSpeed,
        speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
        speed: ballSpeedToLegacySpeed(ballSpeed),
        explanationText: explanationText.trim() || undefined,
      };
      await onSubmit({
        content: explanationText.trim(),
        solutionData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const showImageOnly = !ballPlacement && layoutImageUrl;
  const layoutSrc = layoutImageUrl ? sanitizeImageSrc(layoutImageUrl) : null;

  const C = TROUBLE_SOLUTION_CONSOLE;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 flex flex-col"
      data-trouble-console={C.root}
    >
      {/* 1) 제목/설명 */}
      <div>
        <h2 className="text-lg font-semibold text-site-text">{postTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-wrap line-clamp-4">{postContent}</p>
      </div>

      {/* 2) 공배치도 (확대: PC에서 중심 콘텐츠) */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 self-start">원본 공배치 (읽기 전용)</p>
        <div
          ref={containerRef}
          data-trouble-region={C.region.readonlyLayout}
          className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 w-full max-w-full cursor-crosshair"
          style={{
            maxWidth: LAYOUT_PLACEMENT_MAX_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
          onClick={handleTableClick}
        >
          {ballPlacement ? (
            <div className="absolute inset-0 w-full h-full">
              <NanguReadOnlyLayout
                ballPlacement={ballPlacement}
                showGrid
                fillContainer
                hideObjectBall={false}
                ballNormOverrides={pathPlayback.ballNormOverrides ?? undefined}
                showCueBallSpot={!pathPlayback.isPlaybackActive}
              />
            </div>
          ) : showImageOnly && layoutSrc ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
              <img
                src={layoutSrc}
                alt="원본 공배치"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 text-sm">
              배치 이미지 없음
            </div>
          )}
          <NanguSolutionPathOverlay
            pathPoints={pathPoints}
            cuePos={cuePos}
            objectBallNorm={objectBallNorm}
            objectPathPoints={objectPathPoints}
            width={DEFAULT_TABLE_WIDTH}
            height={DEFAULT_TABLE_HEIGHT}
            pathMode={pathMode}
            objectPathMode={objectPathMode}
            getNormalizedFromEvent={getNormalizedFromEvent}
            onAddPoint={(norm) => {
              const dupThreshold = 0.03;
              const isDup = pathPoints.some((p) => Math.hypot(p.x - norm.x, p.y - norm.y) < dupThreshold);
              if (!isDup) runCueAppend(norm);
            }}
            onRemovePoint={removePathPoint}
            onMovePoint={movePathPoint}
            onInsertBetween={insertPathPointBetween}
            onAddObjectPoint={(norm) => {
              if (!collisionNorm) return;
              const dupThreshold = 0.03;
              const isDup =
                objectPathPoints.length > 0 &&
                objectPathPoints.some((p) => Math.hypot(p.x - norm.x, p.y - norm.y) < dupThreshold);
              if (!isDup) addObjectPathPoint(norm);
            }}
            onRemoveObjectPoint={removeObjectPathPoint}
            onMoveObjectPoint={moveObjectPathPoint}
            onInsertObjectBetween={insertObjectPathPointBetween}
          />
        </div>
      </div>

      {/* 3) 진행경로 관련 버튼 (세로형: 배치도 바로 아래) */}
      <div className="flex flex-wrap items-center gap-2" data-trouble-region={C.region.pathToolbar}>
        <span className="text-sm font-medium text-site-text">진행경로</span>
        <button
          type="button"
          data-trouble-action={C.action.togglePathMode}
          onClick={() => {
            setPathMode((v) => {
              const next = !v;
              if (next) setObjectPathMode(false);
              else setPathRuleHint("");
              return next;
            });
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
            pathMode ? "bg-site-primary text-white border-site-primary" : "border-gray-300 dark:border-slate-600 text-site-text"
          }`}
        >
          {pathMode ? "수구 경로 입력 중" : "수구 경로 입력"}
        </button>
        {pathMode && (
          <button
            type="button"
            data-trouble-action={C.action.clearPath}
            onClick={clearPathPoints}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            수구 경로 전체 삭제
          </button>
        )}
        {objectBallNorm && pathPoints.length >= 1 && collisionNorm && (
          <>
            <button
              type="button"
              onClick={() => {
                setObjectPathMode((v) => {
                  const next = !v;
                  if (next) {
                    setPathMode(false);
                    setActivePanel("path");
                  }
                  return next;
                });
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                objectPathMode
                  ? "bg-sky-600 text-white border-sky-600"
                  : "border-gray-300 dark:border-slate-600 text-site-text"
              }`}
            >
              {objectPathMode ? "1목 경로 입력 중" : "1목 경로 입력"}
            </button>
            {objectPathMode && (
              <button
                type="button"
                onClick={clearObjectPathPoints}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                1목 경로 삭제
              </button>
            )}
          </>
        )}
        {ballPlacement && pathPoints.length >= 1 && (
          <button
            type="button"
            data-trouble-action={C.action.playPath}
            disabled={!pathPlayback.canPlayback || pathPlayback.isPlaybackActive}
            onClick={() => pathPlayback.startPlayback()}
            className="px-3 py-1.5 rounded-lg text-sm border border-amber-400 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pathPlayback.isPlaybackActive ? "재생 중…" : "경로 재생"}
          </button>
        )}
        {pathRuleHint ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 w-full" role="status">
            {pathRuleHint}
          </p>
        ) : null}
        <p className="text-xs text-gray-500 dark:text-slate-400 w-full mt-0.5">
          수구 경로(빨강): 쿠션에 세 번 닿기 전에는 레일 위에만 스팟을 찍을 수 있습니다. 세 번 이후 한 번 더 탭하면 마지막 자유 스팟(end,
          화살표)이 생깁니다. 쿠션·마지막 스팟은 드래그로 조정할 수 있습니다. 1목 경로(하늘)는 별도 규칙입니다.
        </p>
      </div>

      {/* 4) 해법 설정 패널 */}
      <div
        className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4"
        data-trouble-region={C.region.settings}
      >
        <p className="text-sm font-medium text-site-text mb-3">해법 설정</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ["thickness", "두께", C.action.panelThickness],
              ["spin", "당점", C.action.panelSpin],
              ["backstroke", "백스트로크", C.action.panelBackstroke],
              ["followstroke", "팔로우", C.action.panelFollowstroke],
              ["speed", "볼스피드", C.action.panelSpeed],
              ["path", "진행경로", C.action.panelPath],
            ] as const
          ).map(([key, label, actionAttr]) => (
            <button
              key={key}
              type="button"
              data-trouble-action={actionAttr}
              onClick={() => {
                setActivePanel(key);
                if (key === "path") {
                  setPathMode(true);
                  setObjectPathMode(false);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                activePanel === key || (key === "path" && pathMode)
                  ? "bg-site-primary text-white border-site-primary"
                  : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-site-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activePanel === "thickness" && (
          <div className="space-y-2">
            <NanguThicknessEditor
              value={thicknessOffsetX}
              isBankShot={isBankShot}
              onChange={setThicknessOffsetX}
              onBankShotChange={setIsBankShot}
              onFocusZoomRequest={(cx, cy) => setFocusZoom({ active: true, target: "thickness", originX: cx, originY: cy })}
              onFocusZoomEnd={() => setFocusZoom((z) => ({ ...z, active: false }))}
            />
            <p className="text-xs text-gray-500 mt-1">보조: 두께 수치</p>
            <input
              type="range"
              min={0}
              max={1}
              step={1 / 16}
              value={thicknessOffsetX}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                setThicknessOffsetX(v);
                if (getThicknessOverlap(v)) setIsBankShot(false);
              }}
              className="w-full max-w-xs"
            />
          </div>
        )}

        {activePanel === "spin" && (
          <div className="space-y-2">
            <NanguSpinEditor
              spinX={spinX}
              spinY={spinY}
              onChange={({ spinX: x, spinY: y }) => { setSpinX(x); setSpinY(y); }}
              onFocusZoomRequest={(cx, cy) => setFocusZoom({ active: true, target: "spin", originX: cx, originY: cy })}
              onFocusZoomEnd={() => setFocusZoom((z) => ({ ...z, active: false }))}
            />
            <p className="text-xs text-gray-500 mt-1">보조: X/Y 슬라이더</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm w-16">X</span>
                <input type="range" min={-1} max={1} step={0.1} value={spinX} onChange={(e) => setSpinX(e.target.valueAsNumber)} className="w-32" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm w-16">Y</span>
                <input type="range" min={-1} max={1} step={0.1} value={spinY} onChange={(e) => setSpinY(e.target.valueAsNumber)} className="w-32" />
              </label>
            </div>
          </div>
        )}

        {activePanel === "backstroke" && (
          <div className="py-2 -mx-2 px-2 rounded-lg touch-manipulation">
            <p className="text-xs text-gray-500 mb-1">백스트로크: 오른쪽=짧음, 왼쪽=김</p>
            <input
              type="range"
              min={0}
              max={10}
              value={backstrokeLevel}
              onChange={(e) => setBackstrokeLevel(e.target.valueAsNumber)}
              className="w-full max-w-xs"
            />
            <p className="text-xs text-site-text mt-1">{backstrokeLevel} / 10</p>
          </div>
        )}

        {activePanel === "followstroke" && (
          <div className="py-2 -mx-2 px-2 rounded-lg touch-manipulation">
            <p className="text-xs text-gray-500 mb-1">팔로우스트로크: 왼쪽=짧음, 오른쪽=김</p>
            <input
              type="range"
              min={0}
              max={10}
              value={followStrokeLevel}
              onChange={(e) => setFollowStrokeLevel(e.target.valueAsNumber)}
              className="w-full max-w-xs"
            />
            <p className="text-xs text-site-text mt-1">{followStrokeLevel} / 10</p>
          </div>
        )}

        {activePanel === "speed" && (
          <div className="py-2 -mx-2 px-2 rounded-lg touch-manipulation">
            <p className="text-xs text-gray-500 mb-2">볼 스피드: 1.0 ~ 5.0 (0.5 단계)</p>
            <div className="flex flex-wrap items-end gap-1">
              {BALL_SPEED_OPTIONS.map((v) => (
                <div key={v} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setBallSpeed(v)}
                    className={`min-w-[2.25rem] h-8 px-1 flex items-center justify-center text-sm font-bold rounded transition ${
                      ballSpeed === v ? "bg-site-primary text-white" : "bg-gray-200 dark:bg-slate-600 text-site-text hover:bg-gray-300 dark:hover:bg-slate-500"
                    }`}
                  >
                    {v}
                  </button>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">
                    {ballSpeedToRailCount(v)}레일
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-site-text mt-1">
              {ballSpeed} · {ballSpeedToRailCount(ballSpeed)}레일 · 표시 {getRailDisplayPowerForBallSpeed(ballSpeed)}
            </p>
          </div>
        )}

        {activePanel === "path" && (
          <div>
            <p className="text-sm text-site-primary font-medium">진행경로 제시</p>
            <p className="text-xs text-gray-500 mt-1">
              위에서 &quot;경로 입력 시작&quot;을 누른 뒤 배치도를 클릭해 스팟을 순서대로 찍으세요. 수구에서 시작해 목적구·쿠션을 거쳐 경로를 만듭니다.
            </p>
          </div>
        )}
      </div>

      {/* 5) 해설 입력 */}
      <div data-trouble-region={C.region.explanation}>
        <label className="block text-sm font-medium text-site-text mb-1">해설</label>
        <textarea
          value={explanationText}
          onChange={(e) => setExplanationText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          placeholder="해법 설명 (두께·당점·경로 의도, 주의점 등)"
        />
      </div>

      {/* 6) 해법 등록 */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        data-trouble-action={C.action.submitSolution}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
      >
        {saving ? "등록 중…" : "해법 등록"}
      </button>

      {/* 포커스 확대 */}
      {focusZoom.active && focusZoom.target && (
        <NanguFocusZoomOverlay
          active={focusZoom.active}
          target={focusZoom.target}
          originX={focusZoom.originX}
          originY={focusZoom.originY}
          onClose={() => setFocusZoom((z) => ({ ...z, active: false }))}
        >
          {focusZoom.target === "thickness" && (
            <div className="p-4">
              <p className="text-sm font-medium text-site-text mb-2">두께 (확대)</p>
              <NanguThicknessEditor
                value={thicknessOffsetX}
                isBankShot={isBankShot}
                onChange={setThicknessOffsetX}
                onBankShotChange={setIsBankShot}
              />
            </div>
          )}
          {focusZoom.target === "spin" && (
            <div className="p-4">
              <p className="text-sm font-medium text-site-text mb-2">당점 (확대)</p>
              <NanguSpinEditor spinX={spinX} spinY={spinY} onChange={({ spinX: x, spinY: y }) => { setSpinX(x); setSpinY(y); }} />
            </div>
          )}
          {focusZoom.target === "backstroke" && (
            <div className="p-4 min-w-[200px]">
              <p className="text-sm font-medium text-site-text mb-2">백스트로크 (확대)</p>
              <input type="range" min={0} max={10} value={backstrokeLevel} onChange={(e) => setBackstrokeLevel(e.target.valueAsNumber)} className="w-full h-10" />
              <p className="text-xs text-site-text mt-1">{backstrokeLevel} / 10</p>
            </div>
          )}
          {focusZoom.target === "followstroke" && (
            <div className="p-4 min-w-[200px]">
              <p className="text-sm font-medium text-site-text mb-2">팔로우스트로크 (확대)</p>
              <input type="range" min={0} max={10} value={followStrokeLevel} onChange={(e) => setFollowStrokeLevel(e.target.valueAsNumber)} className="w-full h-10" />
              <p className="text-xs text-site-text mt-1">{followStrokeLevel} / 10</p>
            </div>
          )}
          {focusZoom.target === "speed" && (
            <div className="p-4">
              <p className="text-sm font-medium text-site-text mb-2">볼 스피드 (확대)</p>
              <div className="flex flex-wrap items-end gap-1 max-w-[320px]">
                {BALL_SPEED_OPTIONS.map((v) => (
                  <div key={v} className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setBallSpeed(v)}
                      className={`min-w-[2.75rem] h-12 px-1 flex items-center justify-center text-lg font-bold rounded transition ${
                        ballSpeed === v ? "bg-site-primary text-white" : "bg-gray-200 dark:bg-slate-600 text-site-text"
                      }`}
                    >
                      {v}
                    </button>
                    <span className="text-[10px] text-gray-500 mt-0.5">{ballSpeedToRailCount(v)}레일</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-site-text mt-2">
                {ballSpeed} · {ballSpeedToRailCount(ballSpeed)}레일 · 표시 {getRailDisplayPowerForBallSpeed(ballSpeed)}
              </p>
            </div>
          )}
        </NanguFocusZoomOverlay>
      )}

      <CollisionWarningToast
        message={pathPlayback.collisionMessage}
        onDismiss={pathPlayback.dismissCollisionMessage}
      />
    </form>
  );
}
