"use client";

/**
 * 난구해결(trouble) 전용 해법 편집기.
 * - 원본: layoutImageUrl(이미지) 또는 ballPlacement(좌표) 읽기 전용 미리보기
 * - 경로 편집: 전체화면만 (스팟·줌·애니메이션)
 * - 저장: content(해설) + solutionData(JSON)
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  getPlayfieldRect,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import { useTableOrientation } from "@/hooks/useTableOrientation";
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
import { cueFirstObjectHitFromBallPlacement } from "@/lib/solution-path-geometry";
import {
  BALL_SPEED_OPTIONS,
  ballSpeedToLegacySpeed,
  ballSpeedToLegacySpeedLevel,
  ballSpeedToRailCount,
  getRailDisplayPowerForBallSpeed,
  type BallSpeed,
} from "@/lib/ball-speed-constants";
import { SolutionPathEditorFullscreen } from "@/components/nangu/SolutionPathEditorFullscreen";
import { NanguTablePreviewHitLayer } from "@/components/nangu/NanguTablePreviewHitLayer";

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
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>([]);
  const [objectPathPoints, setObjectPathPoints] = useState<NanguPathPoint[]>([]);
  const [pathFsOpen, setPathFsOpen] = useState(false);
  const [pathFsKey, setPathFsKey] = useState(0);
  const [explanationText, setExplanationText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [focusZoom, setFocusZoom] = useState<{
    active: boolean;
    target: NanguFocusZoomTarget;
    originX: number;
    originY: number;
  }>({ active: false, target: null, originX: 0, originY: 0 });

  const previewOrientation = useTableOrientation();

  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

  const cuePos = ballPlacement
    ? ballPlacement.cueBall === "yellow"
      ? ballPlacement.yellowBall
      : ballPlacement.whiteBall
    : { x: 0.5, y: 0.5 };

  const firstObjectHit = useMemo(() => {
    if (!ballPlacement || pathPoints.length < 1) return null;
    return cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], ballPlacement, rect);
  }, [ballPlacement, pathPoints, cuePos, rect]);

  const collisionNorm = firstObjectHit?.collision ?? null;

  const openPathFullscreen = useCallback(() => {
    setPathFsKey((k) => k + 1);
    setPathFsOpen(true);
  }, []);

  const clearCommittedPath = useCallback(() => {
    setPathPoints([]);
    setObjectPathPoints([]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pointsForPath = pathPoints.length >= 1 ? pathPoints.map((p) => ({ x: p.x, y: p.y })) : [];
      let reflectionPath: NanguSolutionData["reflectionPath"];
      let reflectionObjectBall: NanguSolutionData["reflectionObjectBall"];
      if (collisionNorm && objectPathPoints.length >= 1 && ballPlacement && pathPoints.length >= 1) {
        const hit = cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], ballPlacement, rect);
        const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
        reflectionPath = {
          points: [{ x: collisionNorm.x, y: collisionNorm.y }, ...objPts],
          pointsWithType: objectPathPoints,
        };
        reflectionObjectBall = hit?.objectKey;
      }

      const solutionData: NanguSolutionData = {
        isBankShot,
        thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
        tipX: spinX,
        tipY: spinY,
        spinX,
        spinY,
        paths: pointsForPath.length >= 1 ? [{ points: pointsForPath, pointsWithType: pathPoints }] : [],
        reflectionPath,
        reflectionObjectBall,
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

  const previewDisabled = !ballPlacement && !showImageOnly;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 flex flex-col"
      data-trouble-console={C.root}
    >
      {/* 1) 제목/설명 */}
      <div>
        <h2 className="text-lg font-semibold text-site-text">{postTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 whitespace-pre-wrap line-clamp-4">
          {postContent}
        </p>
      </div>

      {/* 2) 공배치 미리보기 — 당구노트 해법과 동일: 기기 방향 반영, 탭 시 당구노트형 전체화면 */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 self-start">
          {ballPlacement
            ? "공 배치 미리보기 (문제에 저장된 좌표 · 수구 표시) — 그림을 탭하면 전체화면에서 경로선을 그립니다"
            : "원본 공배치 (미리보기 · 탭하면 전체화면 경로 편집)"}
        </p>
        <div
          className={`relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 w-full max-w-full ${
            previewDisabled ? "opacity-50" : ""
          }`}
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio:
              previewOrientation === "portrait"
                ? `${DEFAULT_TABLE_HEIGHT} / ${DEFAULT_TABLE_WIDTH}`
                : `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            {ballPlacement ? (
              <>
                <div className="absolute inset-0 w-full h-full">
                  <NanguReadOnlyLayout
                    ballPlacement={ballPlacement}
                    showGrid
                    drawStyle="realistic"
                    fillContainer
                    embedFill
                    className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                    hideObjectBall={false}
                    showCueBallSpot
                    orientation={previewOrientation}
                    betweenTableAndBallsLayer={
                      <NanguSolutionPathOverlay
                        pathPoints={pathPoints}
                        cuePos={cuePos}
                        tableBallPlacement={ballPlacement}
                        objectPathPoints={objectPathPoints}
                        orientation={previewOrientation}
                        pathMode={false}
                        objectPathMode={false}
                        pathLinesVisible={true}
                        ballPickLayout={ballPlacement}
                      />
                    }
                  />
                </div>
                <div
                  className="absolute bottom-1.5 right-1.5 z-[2] rounded-md bg-black/60 text-white text-[10px] sm:text-xs font-medium px-2 py-1 shadow-sm max-w-[min(100%-0.75rem,14rem)] leading-snug text-right"
                  aria-hidden
                >
                  미리보기 · 탭 시 전체화면
                </div>
              </>
            ) : showImageOnly && layoutSrc ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
                  <img src={layoutSrc} alt="원본 공배치" className="w-full h-full object-contain" />
                </div>
                <NanguSolutionPathOverlay
                  pathPoints={pathPoints}
                  cuePos={cuePos}
                  objectPathPoints={objectPathPoints}
                  orientation={previewOrientation}
                  pathMode={false}
                  objectPathMode={false}
                  pathLinesVisible={true}
                />
                <div
                  className="absolute bottom-1.5 right-1.5 z-[2] rounded-md bg-black/60 text-white text-[10px] sm:text-xs font-medium px-2 py-1 shadow-sm max-w-[min(100%-0.75rem,14rem)] leading-snug text-right"
                  aria-hidden
                >
                  미리보기 · 탭 시 전체화면
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 text-sm">
                배치 이미지 없음
              </div>
            )}
          </div>
          <NanguTablePreviewHitLayer
            dataTroubleRegion={C.region.readonlyLayout}
            disabled={previewDisabled}
            className="absolute inset-0 z-[3] cursor-pointer touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-site-primary rounded-lg"
            onOpen={openPathFullscreen}
            ariaLabel="전체화면에서 경로 편집 열기"
          />
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-2 self-stretch"
          data-trouble-region={C.region.pathToolbar}
        >
          <button
            type="button"
            data-trouble-action={C.action.togglePathMode}
            disabled={previewDisabled}
            onClick={openPathFullscreen}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation disabled:opacity-50"
          >
            전체화면 · 경로선 편집
          </button>
          <button
            type="button"
            data-trouble-action={C.action.clearAllPaths}
            disabled={pathPoints.length === 0 && objectPathPoints.length === 0}
            onClick={clearCommittedPath}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 dark:text-red-300 disabled:opacity-50 touch-manipulation"
          >
            저장된 경로 지우기
          </button>
          <span className="text-xs text-gray-500 dark:text-slate-400">
            수구 경로 스팟 {pathPoints.length}개
            {objectPathPoints.length > 0 ? ` · 1목 스팟 ${objectPathPoints.length}개` : ""}
            {pathPoints.length >= 1 ? " · 수구 경로 있음" : ""}
          </span>
        </div>
      </div>

      {pathFsOpen && (
        <SolutionPathEditorFullscreen
          key={pathFsKey}
          variant="trouble"
          presentation="noteBallPlacementFullscreen"
          readOnlyCueAndBalls={!!ballPlacement}
          ballPlacement={ballPlacement}
          layoutImageUrl={ballPlacement ? null : layoutImageUrl}
          initialPathPoints={pathPoints}
          initialObjectPathPoints={objectPathPoints}
          thicknessOffsetX={thicknessOffsetX}
          isBankShot={isBankShot}
          ballSpeed={ballSpeed}
          onCancel={() => setPathFsOpen(false)}
          onConfirm={({ pathPoints: nextCue, objectPathPoints: nextObj }) => {
            setPathPoints(nextCue);
            setObjectPathPoints(nextObj);
            setPathFsOpen(false);
          }}
        />
      )}

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
              onClick={() => setActivePanel(key)}
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
              onChange={setThicknessOffsetX}
              onBankShotChange={setIsBankShot}
              onFocusZoomRequest={(cx, cy) =>
                setFocusZoom({ active: true, target: "thickness", originX: cx, originY: cy })
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
              onFocusZoomRequest={(cx, cy) =>
                setFocusZoom({ active: true, target: "spin", originX: cx, originY: cy })
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
              {ballSpeed} · {ballSpeedToRailCount(ballSpeed)}레일 · 표시{" "}
              {getRailDisplayPowerForBallSpeed(ballSpeed)}
            </p>
          </div>
        )}

        {activePanel === "path" && (
          <div className="space-y-2">
            <p className="text-sm text-site-primary font-medium">진행경로 제시</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              위 미리보기를 탭하거나 버튼으로 <strong>당구노트 공배치와 같은 전체화면</strong>에 들어가 스팟·경로·1목·줌·애니메이션을 사용합니다.
              수구 경로 첫 스팟은 <strong>1목적구</strong> 또는 <strong>쿠션 테두리</strong>에 연결할 수 있습니다. 완료 시 반영, 취소 시 이전 상태로
              돌아갑니다.
            </p>
            <button
              type="button"
              onClick={openPathFullscreen}
              disabled={previewDisabled}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-site-primary text-white hover:opacity-90 touch-manipulation disabled:opacity-50"
            >
              전체화면 · 경로선 편집
            </button>
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
                {ballSpeed} · {ballSpeedToRailCount(ballSpeed)}레일 · 표시{" "}
                {getRailDisplayPowerForBallSpeed(ballSpeed)}
              </p>
            </div>
          )}
        </NanguFocusZoomOverlay>
      )}
    </form>
  );
}
