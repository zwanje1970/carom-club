"use client";

import type { MouseEvent, PointerEvent } from "react";
import type { TableDrawStyle } from "@/components/billiard";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";

export interface PathPlaybackViewOverlayProps {
  /** 애니메이션 재생 중에만 표시 */
  active: boolean;
  pathLinesVisible: boolean;
  onPathLinesVisibleChange: (next: boolean) => void;
  gridVisible: boolean;
  onGridVisibleChange: (next: boolean) => void;
  drawStyle: TableDrawStyle;
  onDrawStyleChange: (next: TableDrawStyle) => void;
  /** data-* 접두 (trouble 콘솔 / 난구) */
  variant?: "trouble" | "nangu";
}

/**
 * 경로 재생 중 시각 옵션 — 항상 현재 상태의 반대 행동 라벨 1개만 표시
 */
export function PathPlaybackViewOverlay({
  active,
  pathLinesVisible,
  onPathLinesVisibleChange,
  gridVisible,
  onGridVisibleChange,
  drawStyle,
  onDrawStyleChange,
  variant = "nangu",
}: PathPlaybackViewOverlayProps) {
  if (!active) return null;

  const p = variant === "trouble" ? "data-trouble-action" : "data-nangu-action";
  const C = TROUBLE_SOLUTION_CONSOLE.action;
  const stop = (e: MouseEvent | PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div
      className="absolute top-2 right-2 z-[110] flex flex-col items-stretch gap-1.5 pointer-events-auto max-w-[11rem]"
      {...(variant === "trouble"
        ? { "data-trouble-region": TROUBLE_SOLUTION_CONSOLE.region.playbackViewControls }
        : { "data-nangu-region": "nangu-playback-view-controls" })}
      onClick={stop}
      onPointerDown={stop}
    >
      <button
        type="button"
        {...{ [p]: variant === "trouble" ? C.playbackTogglePathlines : "nangu-playback-toggle-pathlines" }}
        className="px-2.5 py-1.5 rounded-md text-xs font-medium shadow-md border bg-white/95 dark:bg-slate-900/95 border-gray-200 dark:border-slate-600 text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        onClick={(e) => {
          stop(e);
          onPathLinesVisibleChange(!pathLinesVisible);
        }}
      >
        {pathLinesVisible ? "경로선 숨기기" : "경로선 보이기"}
      </button>
      <button
        type="button"
        {...{ [p]: variant === "trouble" ? C.playbackToggleGrid : "nangu-playback-toggle-grid" }}
        className="px-2.5 py-1.5 rounded-md text-xs font-medium shadow-md border bg-white/95 dark:bg-slate-900/95 border-gray-200 dark:border-slate-600 text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        onClick={(e) => {
          stop(e);
          onGridVisibleChange(!gridVisible);
        }}
      >
        {gridVisible ? "그리드 숨기기" : "그리드 보이기"}
      </button>
      <button
        type="button"
        {...{ [p]: variant === "trouble" ? C.playbackToggleDrawstyle : "nangu-playback-toggle-drawstyle" }}
        className="px-2.5 py-1.5 rounded-md text-xs font-medium shadow-md border bg-white/95 dark:bg-slate-900/95 border-gray-200 dark:border-slate-600 text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        onClick={(e) => {
          stop(e);
          onDrawStyleChange(drawStyle === "realistic" ? "wireframe" : "realistic");
        }}
      >
        {drawStyle === "realistic" ? "단순 보기" : "실사 보기"}
      </button>
    </div>
  );
}
