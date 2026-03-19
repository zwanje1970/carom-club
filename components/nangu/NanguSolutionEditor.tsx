"use client";

/**
 * 난구해결사 해법 편집기 (명세 기반)
 * - 원본 공배치: 읽기 전용
 * - 해법: 두께·당점·백스트로크·팔로우·볼스피드·진행경로·해설 별도 state
 * - 자동 물리 계산 없음, 사용자 수동 조작만
 */
import React, { useState, useCallback, useRef } from "react";
import {
  getPlayfieldRect,
  pixelToNormalized,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import type { NanguPathPoint } from "@/lib/nangu-types";
import { NanguReadOnlyLayout } from "./NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "./NanguSolutionPathOverlay";
import { NanguThicknessEditor, getThicknessOverlap } from "./NanguThicknessEditor";
import { NanguSpinEditor } from "./NanguSpinEditor";
import { NanguFocusZoomOverlay, type NanguFocusZoomTarget } from "./NanguFocusZoomOverlay";

export type NanguActivePanel =
  | "thickness"
  | "spin"
  | "backstroke"
  | "followstroke"
  | "speed"
  | "path";

export interface NanguSolutionEditorProps {
  ballPlacement: NanguBallPlacement;
  postTitle: string;
  postContent: string;
  onSubmit: (payload: {
    title?: string | null;
    comment?: string | null;
    data: NanguSolutionData;
  }) => Promise<void>;
}

const SPEED_RAIL_LABELS = [null, null, "1레일", null, "2레일", null, "3레일", null, "4레일", null, "5레일"] as (string | null)[];

export function NanguSolutionEditor({
  ballPlacement,
  postTitle,
  postContent,
  onSubmit,
}: NanguSolutionEditorProps) {
  const [activePanel, setActivePanel] = useState<NanguActivePanel>("thickness");
  const [isBankShot, setIsBankShot] = useState(false);
  const [thicknessOffsetX, setThicknessOffsetX] = useState(0.5);
  const [spinX, setSpinX] = useState(0);
  const [spinY, setSpinY] = useState(0);
  const [backstrokeLevel, setBackstrokeLevel] = useState(5);
  const [followStrokeLevel, setFollowStrokeLevel] = useState(5);
  const [speedLevel, setSpeedLevel] = useState(5);
  const [pathMode, setPathMode] = useState(false);
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>([]);
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

  const cueBall = ballPlacement.cueBall;
  const cuePos = cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;

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
    let nx = x,
      ny = y;
    let onEdge = false;
    if (x <= margin) {
      nx = 0;
      onEdge = true;
    } else if (x >= 1 - margin) {
      nx = 1;
      onEdge = true;
    }
    if (y <= margin) {
      ny = 0;
      onEdge = true;
    } else if (y >= 1 - margin) {
      ny = 1;
      onEdge = true;
    }
    return { x: nx, y: ny, type: onEdge ? "cushion" : "free" };
  }, []);

  const addPathPoint = useCallback(
    (norm: { x: number; y: number }, type?: "ball" | "cushion" | "free") => {
      const snapped =
        type != null
          ? { x: norm.x, y: norm.y, type }
          : snapToCushionIfNear(norm.x, norm.y);
      setPathPoints((prev) => [
        ...prev,
        {
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          x: snapped.x,
          y: snapped.y,
          type: snapped.type,
        },
      ]);
    },
    [snapToCushionIfNear]
  );

  const clearPathPoints = useCallback(() => setPathPoints([]), []);

  const movePathPoint = useCallback((id: string, norm: { x: number; y: number }) => {
    const snapped = snapToCushionIfNear(norm.x, norm.y);
    setPathPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x: snapped.x, y: snapped.y, type: snapped.type } : p))
    );
  }, [snapToCushionIfNear]);

  const removePathPoint = useCallback((id: string) => {
    setPathPoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const insertPathPointBetween = useCallback((segmentIndex: number, norm: { x: number; y: number }) => {
    const snapped = snapToCushionIfNear(norm.x, norm.y);
    const newPoint: NanguPathPoint = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: snapped.x,
      y: snapped.y,
      type: snapped.type,
    };
    setPathPoints((prev) => {
      const next = [...prev];
      next.splice(segmentIndex, 0, newPoint);
      return next;
    });
  }, [snapToCushionIfNear]);

  const handleTableClick = useCallback(
    (e: React.MouseEvent) => {
      if (!pathMode) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      const dupThreshold = 0.03;
      const isDup =
        pathPoints.length > 0 &&
        pathPoints.some(
          (p) => Math.hypot(p.x - norm.x, p.y - norm.y) < dupThreshold
        );
      if (isDup) return;
      addPathPoint(norm);
    },
    [pathMode, getNormalizedFromEvent, addPathPoint, pathPoints.length]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath = pathPoints.length >= 1
        ? pathPoints.map((p) => ({ x: p.x, y: p.y }))
        : [];
      await onSubmit({
        title: null,
        comment: explanationText.trim() || null,
        data: {
          isBankShot,
          thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
          tipX: spinX,
          tipY: spinY,
          spinX,
          spinY,
          paths: pointsForPath.length >= 2 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
          backstrokeLevel,
          followStrokeLevel,
          speedLevel,
          speed: Math.ceil(speedLevel / 2),
          explanationText: explanationText.trim() || undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. 상단 정보 영역 */}
      <div>
        <h2 className="text-lg font-semibold text-site-text">{postTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{postContent}</p>
      </div>

      {/* 2. 중앙 배치도 + 진행선 오버레이 */}
      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">원본 공배치 (읽기 전용)</p>
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 w-full max-w-full cursor-crosshair"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
          onClick={handleTableClick}
        >
          <NanguReadOnlyLayout ballPlacement={ballPlacement} showGrid />
          <NanguSolutionPathOverlay
            pathPoints={pathPoints}
            cuePos={cuePos}
            width={DEFAULT_TABLE_WIDTH}
            height={DEFAULT_TABLE_HEIGHT}
            pathMode={pathMode}
            getNormalizedFromEvent={getNormalizedFromEvent}
            onAddPoint={(norm) => {
              const dupThreshold = 0.03;
              const isDup =
                pathPoints.length > 0 &&
                pathPoints.some((p) => Math.hypot(p.x - norm.x, p.y - norm.y) < dupThreshold);
              if (!isDup) addPathPoint(norm);
            }}
            onRemovePoint={removePathPoint}
            onMovePoint={movePathPoint}
            onInsertBetween={insertPathPointBetween}
          />
        </div>
        {pathMode && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-site-primary font-medium">진행경로 모드</span>
            <button
              type="button"
              onClick={clearPathPoints}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              전체선 삭제
            </button>
          </div>
        )}
      </div>

      {/* 3. 설정패널 영역 */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4">
        <p className="text-sm font-medium text-site-text mb-3">해법 설정</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ["thickness", "두께"],
              ["spin", "당점"],
              ["backstroke", "백스트로크"],
              ["followstroke", "팔로우"],
              ["speed", "볼스피드"],
              ["path", "진행경로"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActivePanel(key);
                if (key === "path") setPathMode(true);
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
              onFocusZoomRequest={(clientX, clientY) =>
                setFocusZoom({ active: true, target: "thickness", originX: clientX, originY: clientY })
              }
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
              onChange={({ spinX: x, spinY: y }) => {
                setSpinX(x);
                setSpinY(y);
              }}
              onFocusZoomRequest={(clientX, clientY) =>
                setFocusZoom({ active: true, target: "spin", originX: clientX, originY: clientY })
              }
              onFocusZoomEnd={() => setFocusZoom((z) => ({ ...z, active: false }))}
            />
            <p className="text-xs text-gray-500 mt-1">보조: X/Y 슬라이더</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm w-16">X</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={spinX}
                  onChange={(e) => setSpinX(e.target.valueAsNumber)}
                  className="w-32"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm w-16">Y</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.1}
                  value={spinY}
                  onChange={(e) => setSpinY(e.target.valueAsNumber)}
                  className="w-32"
                />
              </label>
            </div>
          </div>
        )}

        {activePanel === "backstroke" && (
          <div
            className="py-2 -mx-2 px-2 rounded-lg touch-manipulation"
            onPointerDown={(e) =>
              setFocusZoom({ active: true, target: "backstroke", originX: e.clientX, originY: e.clientY })
            }
          >
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
          <div
            className="py-2 -mx-2 px-2 rounded-lg touch-manipulation"
            onPointerDown={(e) =>
              setFocusZoom({ active: true, target: "followstroke", originX: e.clientX, originY: e.clientY })
            }
          >
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
          <div
            className="py-2 -mx-2 px-2 rounded-lg touch-manipulation"
            onPointerDown={(e) =>
              setFocusZoom({ active: true, target: "speed", originX: e.clientX, originY: e.clientY })
            }
          >
            <p className="text-xs text-gray-500 mb-2">볼스피드: 1~10 (레일 참고)</p>
            <div className="flex items-end gap-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSpeedLevel(i)}
                    className={`w-7 h-8 flex items-center justify-center text-lg font-bold rounded transition ${
                      speedLevel === i
                        ? "bg-site-primary text-white"
                        : "bg-gray-200 dark:bg-slate-600 text-site-text hover:bg-gray-300 dark:hover:bg-slate-500"
                    }`}
                  >
                    &gt;
                  </button>
                  {SPEED_RAIL_LABELS[i] && (
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                      {SPEED_RAIL_LABELS[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-site-text mt-1">{speedLevel} / 10</p>
          </div>
        )}

        {activePanel === "path" && (
          <div>
            <p className="text-sm text-site-primary font-medium">진행경로 제시</p>
            <p className="text-xs text-gray-500 mt-1">
              위 배치도를 클릭해 스팟을 순서대로 찍으세요. 수구에서 시작해 목적구·쿠션을 거쳐 경로를 만듭니다.
            </p>
            <button
              type="button"
              onClick={() => setPathMode(!pathMode)}
              className={`mt-2 px-3 py-1.5 rounded-lg text-sm ${pathMode ? "bg-site-primary text-white" : "border border-gray-300 dark:border-slate-600"}`}
            >
              {pathMode ? "경로 입력 중" : "경로 입력 시작"}
            </button>
          </div>
        )}
      </div>

      {/* 4. 해설 입력 */}
      <div>
        <label className="block text-sm font-medium text-site-text mb-1">해설</label>
        <textarea
          value={explanationText}
          onChange={(e) => setExplanationText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          placeholder="해법 설명을 입력하세요 (두께·당점·경로 의도, 주의점 등)"
        />
      </div>

      {/* 5. 제출 */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50"
      >
        {saving ? "저장 중…" : "해법 등록"}
      </button>

      {/* 포커스 확대 오버레이 */}
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
              <NanguSpinEditor
                spinX={spinX}
                spinY={spinY}
                onChange={({ spinX: x, spinY: y }) => {
                  setSpinX(x);
                  setSpinY(y);
                }}
              />
            </div>
          )}
          {focusZoom.target === "backstroke" && (
            <div className="p-4 min-w-[200px]">
              <p className="text-sm font-medium text-site-text mb-2">백스트로크 (확대)</p>
              <p className="text-xs text-gray-500 mb-1">오른쪽=짧음, 왼쪽=김</p>
              <input
                type="range"
                min={0}
                max={10}
                value={backstrokeLevel}
                onChange={(e) => setBackstrokeLevel(e.target.valueAsNumber)}
                className="w-full h-10"
              />
              <p className="text-xs text-site-text mt-1">{backstrokeLevel} / 10</p>
            </div>
          )}
          {focusZoom.target === "followstroke" && (
            <div className="p-4 min-w-[200px]">
              <p className="text-sm font-medium text-site-text mb-2">팔로우스트로크 (확대)</p>
              <p className="text-xs text-gray-500 mb-1">왼쪽=짧음, 오른쪽=김</p>
              <input
                type="range"
                min={0}
                max={10}
                value={followStrokeLevel}
                onChange={(e) => setFollowStrokeLevel(e.target.valueAsNumber)}
                className="w-full h-10"
              />
              <p className="text-xs text-site-text mt-1">{followStrokeLevel} / 10</p>
            </div>
          )}
          {focusZoom.target === "speed" && (
            <div className="p-4">
              <p className="text-sm font-medium text-site-text mb-2">볼스피드 (확대)</p>
              <div className="flex items-end gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setSpeedLevel(i)}
                      className={`w-10 h-12 flex items-center justify-center text-xl font-bold rounded transition ${
                        speedLevel === i ? "bg-site-primary text-white" : "bg-gray-200 dark:bg-slate-600 text-site-text"
                      }`}
                    >
                      &gt;
                    </button>
                    {SPEED_RAIL_LABELS[i] && (
                      <span className="text-xs text-gray-500 mt-0.5">{SPEED_RAIL_LABELS[i]}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-site-text mt-1">{speedLevel} / 10</p>
            </div>
          )}
        </NanguFocusZoomOverlay>
      )}
    </form>
  );
}
