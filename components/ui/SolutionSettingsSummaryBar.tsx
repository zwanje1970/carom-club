"use client";

import {
  CUE_TIP_NORM_DISPLAY_FRAC,
  thicknessDisplayOverlapStep16,
} from "@/lib/solution-panel-ball-layout";
import {
  DEFAULT_SOLUTION_SETTINGS,
  mergeSolutionSettings,
  type SolutionSettingsValue,
} from "@/lib/solution-settings-panel-value";

const IMG_BALL_WHITE = "/images/billiard/ball-white.svg";

export type SolutionSettingsSummarySection = "thickness" | "tip" | "rail";

type SolutionSettingsSummaryBarProps = {
  value: SolutionSettingsValue | undefined;
  onThicknessClick: () => void;
  onTipClick: () => void;
  onRailClick: () => void;
  onPlayClick?: () => void;
  playDisabled?: boolean;
  playActive?: boolean;
  className?: string;
};

/**
 * 해법 설정 요약 — `panelSettings` 단일 소스를 그대로 표시.
 */
export function SolutionSettingsSummaryBar({
  value,
  onThicknessClick,
  onTipClick,
  onRailClick,
  onPlayClick,
  playDisabled = false,
  playActive = false,
  className = "",
}: SolutionSettingsSummaryBarProps) {
  const v = mergeSolutionSettings(value ?? DEFAULT_SOLUTION_SETTINGS, DEFAULT_SOLUTION_SETTINGS);
  const { tipNorm, thicknessStep } = v;
  const thicknessDisplay = thicknessDisplayOverlapStep16(thicknessStep);
  const railDisplayInt = Math.max(1, Math.min(5, Math.round(v.railCount)));

  const segmentBtn =
    "flex h-12 min-w-0 flex-1 touch-manipulation items-center justify-center border-0 border-r border-amber-900/80 bg-transparent px-1 text-center last:border-r-0";

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-md items-stretch rounded-t-lg border border-amber-900/90 bg-gradient-to-b from-stone-900 to-black text-white shadow-[0_-4px_24px_rgba(0,0,0,0.55)] ${className}`}
      role="group"
      aria-label="해법 설정 요약"
    >
      <button type="button" className={segmentBtn} onClick={onThicknessClick} aria-label="공 두께 설정 열기">
        <span className="text-sm font-bold tabular-nums text-amber-300">{thicknessDisplay}/16</span>
      </button>
      <button type="button" className={segmentBtn} onClick={onTipClick} aria-label="당점 설정 열기">
        <span className="relative mx-auto block h-9 w-9 shrink-0">
          <img
            src={IMG_BALL_WHITE}
            alt=""
            width={36}
            height={36}
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-contain opacity-95"
          />
          <span
            className="pointer-events-none absolute h-2 w-2 rounded-full border border-black bg-[#6699ff]"
            style={{
              left: `${50 + tipNorm.x * 50 * CUE_TIP_NORM_DISPLAY_FRAC}%`,
              top: `${50 + tipNorm.y * 50 * CUE_TIP_NORM_DISPLAY_FRAC}%`,
              transform: "translate(-50%, -50%)",
            }}
            aria-hidden
          />
        </span>
      </button>
      <button
        type="button"
        className={`${segmentBtn} whitespace-nowrap`}
        onClick={onRailClick}
        aria-label="레일 거리 설정 열기"
      >
        <span className="text-sm font-bold leading-tight text-amber-300 tabular-nums">
          R{railDisplayInt}
        </span>
      </button>
      {onPlayClick && (
        <button
          type="button"
          className={`${segmentBtn} whitespace-nowrap border-r-0 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50`}
          onClick={onPlayClick}
          disabled={playDisabled}
          aria-label={playActive ? "애니메이션 재생 중" : "애니메이션 재생"}
        >
          <span className="text-base font-bold leading-tight text-amber-200 tabular-nums" aria-hidden>
            {playActive ? "||" : "▶"}
          </span>
        </button>
      )}
    </div>
  );
}

