"use client";

/**
 * 난구해결사 해법 편집기 (명세 기반)
 * - 원본 공배치: 읽기 전용
 * - 해법: 두께·당점·백스트로크·팔로우·볼스피드·진행경로·해설 별도 state
 * - 자동 물리 계산 없음, 사용자 수동 조작만
 * - 되돌리기: 직전 편집 스냅샷으로 복원 (최대 NANGU_SOLUTION_EDITOR_MAX_UNDO 단계)
 */
import React, { useState, useCallback } from "react";
import { DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { NanguReadOnlyLayout } from "./NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "./NanguSolutionPathOverlay";
import { NanguThicknessEditor, getThicknessOverlap } from "./NanguThicknessEditor";
import { NanguSpinEditor } from "./NanguSpinEditor";
import { NanguFocusZoomOverlay, type NanguFocusZoomTarget } from "./NanguFocusZoomOverlay";
import {
  BALL_SPEED_OPTIONS,
  ballSpeedToLegacySpeed,
  ballSpeedToLegacySpeedLevel,
  ballSpeedToRailCount,
  getRailDisplayPowerForBallSpeed,
} from "@/lib/ball-speed-constants";
import { SolutionPathEditorFullscreen } from "./SolutionPathEditorFullscreen";
import { NanguTablePreviewHitLayer } from "./NanguTablePreviewHitLayer";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import {
  type NanguSolutionEditorUndoSnapshot,
  cloneNanguSolutionEditorSnapshot,
  createInitialNanguSolutionEditorSnapshot,
  NANGU_SOLUTION_EDITOR_MAX_UNDO,
  type NanguActivePanel,
} from "@/lib/nangu-solution-editor-undo";

export type { NanguActivePanel };

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

export function NanguSolutionEditor({
  ballPlacement,
  postTitle,
  postContent,
  onSubmit,
}: NanguSolutionEditorProps) {
  const [editor, setEditor] = useState<NanguSolutionEditorUndoSnapshot>(() =>
    createInitialNanguSolutionEditorSnapshot()
  );
  const [undoStack, setUndoStack] = useState<NanguSolutionEditorUndoSnapshot[]>([]);

  const commit = useCallback(
    (updater: (prev: NanguSolutionEditorUndoSnapshot) => NanguSolutionEditorUndoSnapshot) => {
      setEditor((prev) => {
        setUndoStack((stack) => [
          ...stack.slice(-(NANGU_SOLUTION_EDITOR_MAX_UNDO - 1)),
          cloneNanguSolutionEditorSnapshot(prev),
        ]);
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const top = stack[stack.length - 1]!;
      setEditor(cloneNanguSolutionEditorSnapshot(top));
      return stack.slice(0, -1);
    });
  }, []);

  const canUndo = undoStack.length > 0;

  const {
    activePanel,
    isBankShot,
    thicknessOffsetX,
    spinX,
    spinY,
    backstrokeLevel,
    followStrokeLevel,
    ballSpeed,
    pathPoints,
    explanationText,
  } = editor;

  /** 당구노트형 전체화면(오버레이) + 경로 편집 UI (스팟·줌·재생은 이 상태에서만) */
  const [fullScreenEditMode, setFullScreenEditMode] = useState(false);
  const [pathFsKey, setPathFsKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [focusZoom, setFocusZoom] = useState<{
    active: boolean;
    target: NanguFocusZoomTarget;
    originX: number;
    originY: number;
  }>({ active: false, target: null, originX: 0, originY: 0 });

  const previewOrientation = useTableOrientation();

  const cueBall = ballPlacement.cueBall;
  const cuePos = cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;

  const closeFullScreenEdit = useCallback(() => {
    setFullScreenEditMode(false);
  }, []);

  /** 미리보기 탭/버튼: 당구노트 공배치와 동일한 전체화면 셸로 경로 편집 */
  const enterFullScreenEdit = useCallback(() => {
    setPathFsKey((k) => k + 1);
    setFullScreenEditMode(true);
  }, []);

  const clearCommittedPath = useCallback(() => {
    commit((prev) => ({ ...prev, pathPoints: [] }));
  }, [commit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath =
        pathPoints.length >= 1 ? pathPoints.map((p) => ({ x: p.x, y: p.y })) : [];
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
          paths: pointsForPath.length >= 1 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
          backstrokeLevel,
          followStrokeLevel,
          ballSpeed,
          speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
          speed: ballSpeedToLegacySpeed(ballSpeed),
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

      {/* 2. 당구노트 공배치와 동일 좌표 미리보기 — 탭/버튼으로 전체화면 경로 편집 (테이블 가운데 정렬) */}
      <div className="flex w-full flex-col items-center">
        <div
          className="relative mx-auto w-full max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio:
              previewOrientation === "portrait"
                ? `${DEFAULT_TABLE_HEIGHT} / ${DEFAULT_TABLE_WIDTH}`
                : `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
        >
          {/* 캔버스·SVG는 포인터 통과 → 히트 레이어만 탭 수신 */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0">
              <NanguReadOnlyLayout
                ballPlacement={ballPlacement}
                fillContainer
                embedFill
                className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                showGrid
                drawStyle="realistic"
                showCueBallSpot
                orientation={previewOrientation}
                betweenTableAndBallsLayer={
                  <NanguSolutionPathOverlay
                    pathPoints={pathPoints}
                    cuePos={cuePos}
                    tableBallPlacement={ballPlacement}
                    objectPathPoints={[]}
                    orientation={previewOrientation}
                    pathMode={false}
                    objectPathMode={false}
                    pathLinesVisible={true}
                    ballPickLayout={ballPlacement}
                  />
                }
              />
            </div>
          </div>
          <NanguTablePreviewHitLayer
            className="absolute inset-0 z-[3] cursor-pointer touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-site-primary rounded-lg"
            onOpen={enterFullScreenEdit}
            ariaLabel="전체화면에서 경로 편집 열기"
          />
        </div>
        <div
          className="mx-auto mt-2 flex w-full max-w-full flex-wrap items-center justify-center gap-2"
          style={{ maxWidth: DEFAULT_TABLE_WIDTH }}
        >
          <button
            type="button"
            onClick={() => enterFullScreenEdit()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation"
          >
            전체화면 · 경로선 편집
          </button>
          <button
            type="button"
            disabled={pathPoints.length === 0}
            onClick={clearCommittedPath}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 dark:text-red-300 disabled:opacity-50 touch-manipulation"
          >
            저장된 경로 지우기
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            수구 경로 스팟 {pathPoints.length}개
            {pathPoints.length >= 1 ? " · 수구 경로 있음" : ""}
          </span>
        </div>
      </div>

      {fullScreenEditMode && (
        <SolutionPathEditorFullscreen
          key={pathFsKey}
          variant="nangu"
          presentation="noteBallPlacementFullscreen"
          ballPlacement={ballPlacement}
          initialPathPoints={pathPoints}
          initialObjectPathPoints={[]}
          thicknessOffsetX={thicknessOffsetX}
          isBankShot={isBankShot}
          ballSpeed={ballSpeed}
          onCancel={closeFullScreenEdit}
          onConfirm={({ pathPoints: next }) => {
            commit((prev) => ({ ...prev, pathPoints: next }));
            closeFullScreenEdit();
          }}
        />
      )}

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
              onClick={() => commit((prev) => ({ ...prev, activePanel: key }))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                activePanel === key
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
              onChange={(v) => commit((prev) => ({ ...prev, thicknessOffsetX: v }))}
              onBankShotChange={(v) => commit((prev) => ({ ...prev, isBankShot: v }))}
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
                commit((prev) => {
                  let nextBank = prev.isBankShot;
                  if (getThicknessOverlap(v)) nextBank = false;
                  return { ...prev, thicknessOffsetX: v, isBankShot: nextBank };
                });
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
                commit((prev) => ({ ...prev, spinX: x, spinY: y }));
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
                  onChange={(e) =>
                    commit((prev) => ({ ...prev, spinX: e.target.valueAsNumber }))
                  }
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
                  onChange={(e) =>
                    commit((prev) => ({ ...prev, spinY: e.target.valueAsNumber }))
                  }
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
              onChange={(e) =>
                commit((prev) => ({ ...prev, backstrokeLevel: e.target.valueAsNumber }))
              }
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
              onChange={(e) =>
                commit((prev) => ({ ...prev, followStrokeLevel: e.target.valueAsNumber }))
              }
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
            <p className="text-xs text-gray-500 mb-2">볼 스피드: 1.0 ~ 5.0 (0.5 단계)</p>
            <div className="flex flex-wrap items-end gap-1">
              {BALL_SPEED_OPTIONS.map((v) => (
                <div key={v} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => commit((prev) => ({ ...prev, ballSpeed: v }))}
                    className={`min-w-[2.25rem] h-8 px-1 flex items-center justify-center text-sm font-bold rounded transition ${
                      ballSpeed === v
                        ? "bg-site-primary text-white"
                        : "bg-gray-200 dark:bg-slate-600 text-site-text hover:bg-gray-300 dark:hover:bg-slate-500"
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
          <div className="space-y-2">
            <p className="text-sm text-site-primary font-medium">진행경로 제시</p>
            <button
              type="button"
              onClick={() => enterFullScreenEdit()}
              className="mt-1 px-3 py-2 rounded-lg text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation"
            >
              전체화면 · 경로선 편집
            </button>
          </div>
        )}
      </div>

      {/* 4. 해설 입력 */}
      <div>
        <label className="block text-sm font-medium text-site-text mb-1">해설</label>
        <textarea
          value={explanationText}
          onChange={(e) => commit((prev) => ({ ...prev, explanationText: e.target.value }))}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          placeholder="해법 설명을 입력하세요 (두께·당점·경로 의도, 주의점 등)"
        />
      </div>

      {/* 5. 제출 */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
        <button
          type="button"
          disabled={!canUndo || saving}
          onClick={handleUndo}
          title={`직전 편집 상태로 되돌립니다 (최대 ${NANGU_SOLUTION_EDITOR_MAX_UNDO}단계)`}
          className="sm:w-40 py-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-site-text font-medium disabled:opacity-45 disabled:pointer-events-none hover:bg-gray-50 dark:hover:bg-slate-700 touch-manipulation"
        >
          되돌리기
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 min-h-[3rem] py-3 rounded-lg bg-site-primary text-white font-medium disabled:opacity-50 touch-manipulation"
        >
          {saving ? "저장 중…" : "해법 등록"}
        </button>
      </div>

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
                onChange={(v) => commit((prev) => ({ ...prev, thicknessOffsetX: v }))}
                onBankShotChange={(v) => commit((prev) => ({ ...prev, isBankShot: v }))}
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
                  commit((prev) => ({ ...prev, spinX: x, spinY: y }));
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
                onChange={(e) =>
                  commit((prev) => ({ ...prev, backstrokeLevel: e.target.valueAsNumber }))
                }
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
                onChange={(e) =>
                  commit((prev) => ({ ...prev, followStrokeLevel: e.target.valueAsNumber }))
                }
                className="w-full h-10"
              />
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
                      onClick={() => commit((prev) => ({ ...prev, ballSpeed: v }))}
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
    </form>
  );
}
