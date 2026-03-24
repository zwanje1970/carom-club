"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  type SolutionSettingsValue,
  DEFAULT_SOLUTION_SETTINGS,
  mergeSolutionSettings,
  type CueSide,
  PANEL_DEFAULT_TOUCHING_THICKNESS_STEP,
} from "@/lib/solution-settings-panel-value";
import {
  PANEL_LAYOUT_REF_BALL_PX,
  clampLayoutDxToMiniArena,
  cueCenterOffsetPxFromRed,
  CUE_TIP_MARK_RADIUS_FRAC,
  CUE_TIP_NORM_DISPLAY_FRAC,
  discreteCueLayoutDxRange,
  indexOfNearestDiscreteCueDx,
  listDiscreteCueLayoutDx,
  snapCueLayoutToDiscreteDx,
} from "@/lib/solution-panel-ball-layout";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

export type { CueSide, SolutionSettingsValue };
export {
  DEFAULT_SOLUTION_SETTINGS,
  mergeSolutionSettings,
  PANEL_DEFAULT_TOUCHING_THICKNESS_STEP,
} from "@/lib/solution-settings-panel-value";

const IMG_BALL_RED = "/images/billiard/ball-red.svg";
const IMG_BALL_WHITE = "/images/billiard/ball-white.svg";
/** ?먭퍡 議곗젙 ????諛⑹궗?빧룸룞?ъ썝 媛?대뱶 ?놁쓬(?뱀젏 紐⑤뱶?먯꽌留?`IMG_BALL_WHITE`) */
const IMG_BALL_WHITE_NO_GUIDE = "/images/billiard/ball-white-no-guide.svg";

/** viewBox 0 0 100 100 ??媛濡??ㅽ뀥 + ?붿궡 癒몃━ (<------------- / ------------->) */
const ARROW_TRACK_PATH_LEFT =
  "M 0 50 L 14 36 L 14 44 L 100 44 L 100 56 L 14 56 L 14 64 Z";
const ARROW_TRACK_PATH_RIGHT =
  "M 100 50 L 86 36 L 86 44 L 0 44 L 0 56 L 86 56 L 86 64 Z";

/** ?쒖떆 怨?吏由????덉씠?꾩썐 ?섑븰? `PANEL_LAYOUT_REF_BALL_PX`(48) 湲곗????ㅼ??쇰쭔 ?곸슜 */
const BALL_DISPLAY_PX = 100;
const BALL_SCALE = BALL_DISPLAY_PX / PANEL_LAYOUT_REF_BALL_PX;
const BALL_R = BALL_DISPLAY_PX / 2;

/** ?뱀젏 ?몄쭛 紐⑤뱶?먯꽌 ?섍뎄留??쒓컖 ?뺣? ??`cueCenter`쨌BALL_R쨌?뱀젏 ?섑븰? 洹몃?濡?*/
const CUE_TIP_EDIT_SCALE = 1.65;
const CUE_TIP_EDIT_TRANSITION_MS = 150;

const ARENA_W = 340;
const ARENA_H = 132;

const TIP_MAX_FRAC = CUE_TIP_NORM_DISPLAY_FRAC;
/** viewBox 0~100 ??怨?諛섏?由?50, ?뱀젏 ??= 怨?諛섏?由?횞 CUE_TIP_MARK_RADIUS_FRAC */
const TIP_MARK_RADIUS_VB = CUE_TIP_MARK_RADIUS_FRAC * 50;

function clampToUnitDisk(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len <= 1 || len < 1e-9) return { x, y };
  return { x: x / len, y: y / len };
}

const TRACK_PAD_FRAC = 0.06;
const STROKE_MAX = 6;
/** ?뺢킅 ?뚮?(?쒖븞) ???щ씪?대뜑 梨꾩? */
const SLIDER_GLOW_FILL = "rgba(0, 245, 255, 0.52)";

/** ?대? step(0=寃뱀묠??6=?⑥뼱吏? ???쒖떆 n/16 (16=?꾩쟾 寃뱀묠, 0=?꾩쟾 遺꾨━) */
function thicknessDisplayStep16(storedStep: number): number {
  const s = Math.max(0, Math.min(16, Math.round(storedStep)));
  return 16 - s;
}

type ArrowStrokeSliderProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  /** ?붾줈?? ?쇱そ??0쨌?ㅻⅨ履쎌씠 ??媛?/ 諛? ?ㅻⅨ履쎌씠 0쨌?쇱そ????媛?諛섎?) */
  direction: "ltr" | "rtl";
  /** 諛? ?쇱そ ?붿궡 ?덉そ ???덇툑 ?쒓굅, ?붾줈?? ?ㅻⅨ履??붿궡 ?덉そ ???덇툑 ?쒓굅 */
  tickVariant: "hideLeft" | "hideRight";
  "aria-label": string;
  active: boolean;
  onActivate: () => void;
};

function strokeThumbFrac(v: number, direction: "ltr" | "rtl"): number {
  const n = Math.max(0, Math.min(STROKE_MAX, Math.round(v)));
  if (direction === "ltr") {
    return TRACK_PAD_FRAC + (n / 7) * (1 - 2 * TRACK_PAD_FRAC);
  }
  /** RTL 諛? 媛?0=?ㅻⅨ履??????レ옄쨌?몄쓣 ?덇툑 湲곗? 1移??ㅻⅨ履??뺣젹 (遺꾨え 7, 媛꾧꺽 6移? */
  return TRACK_PAD_FRAC + ((7 - n) / 7) * (1 - 2 * TRACK_PAD_FRAC);
}

function ArrowStrokeSlider({
  label,
  value,
  onChange,
  direction,
  tickVariant,
  "aria-label": ariaLabel,
  active,
  onActivate,
}: ArrowStrokeSliderProps) {
  const baseGradId = useId().replace(/:/g, "");
  const trackRef = useRef<HTMLDivElement>(null);
  const v = Math.max(0, Math.min(STROKE_MAX, Math.round(value)));
  const thumbFrac = strokeThumbFrac(v, direction);
  const thumbPct = thumbFrac * 100;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let t = (clientX - r.left) / r.width;
      t = Math.max(0, Math.min(1, t));
      const inner = Math.max(
        0,
        Math.min(1, (t - TRACK_PAD_FRAC) / (1 - 2 * TRACK_PAD_FRAC))
      );
      /** ?щ’ 0~6 (0~6 援ш컙) ??round(inner*7) ??7? 6?쇰줈(?ㅻⅨ履???媛?0) */
      let slot = Math.round(inner * 7);
      slot = Math.max(0, Math.min(STROKE_MAX, slot));
      const next = direction === "ltr" ? slot : STROKE_MAX - slot;
      onChange(next);
    },
    [onChange, direction]
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      onActivate();
      e.currentTarget.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
    },
    [setFromClientX, onActivate]
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      setFromClientX(e.clientX);
    },
    [setFromClientX]
  );

  const handleStrokeCardKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 2 : 1;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onActivate();
        if (direction === "ltr") {
          onChange(Math.max(0, v - step));
        } else {
          onChange(Math.min(STROKE_MAX, v + step));
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onActivate();
        if (direction === "ltr") {
          onChange(Math.min(STROKE_MAX, v + step));
        } else {
          onChange(Math.max(0, v - step));
        }
      }
    },
    [direction, onActivate, onChange, v]
  );

  const trackPath = tickVariant === "hideLeft" ? ARROW_TRACK_PATH_LEFT : ARROW_TRACK_PATH_RIGHT;
  const labelAtIndex = (j: number) => (direction === "ltr" ? j : STROKE_MAX - j);

  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/[0.05] px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
        active ? "ring-1 ring-cyan-400/55 ring-offset-1 ring-offset-slate-900/80" : ""
      }`}
      tabIndex={0}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={STROKE_MAX}
      aria-valuenow={v}
      onClick={() => onActivate()}
      onFocus={() => onActivate()}
      onKeyDown={handleStrokeCardKeyDown}
    >
      <p className="mb-1 text-center text-[10px] font-medium text-slate-300">{label}</p>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        onPointerCancel={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        className="relative h-10 w-full cursor-pointer touch-manipulation"
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-sky-500/35"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={baseGradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgb(56 189 248 / 0.35)" />
              <stop offset="50%" stopColor="rgb(51 65 85 / 0.25)" />
              <stop offset="100%" stopColor="rgb(56 189 248 / 0.35)" />
            </linearGradient>
          </defs>
          <path
            d={trackPath}
            fill={`url(#${baseGradId})`}
            stroke="rgb(255 255 255 / 0.14)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath:
              direction === "ltr"
                ? `inset(0 ${Math.max(0, 100 - thumbPct)}% 0 0)`
                : `inset(0 0 0 ${Math.max(0, Math.min(100, thumbPct))}%)`,
          }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d={trackPath} fill={SLIDER_GLOW_FILL} stroke="none" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 8 }, (_, i) => {
            if (tickVariant === "hideLeft" && i === 0) return null;
            if (tickVariant === "hideRight" && i === 7) return null;
            return (
              <div
                key={i}
                className="absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40"
                style={{
                  left: `${(TRACK_PAD_FRAC + (i / 7) * (1 - 2 * TRACK_PAD_FRAC)) * 100}%`,
                }}
              />
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-0 top-[calc(50%+0.45rem)]">
          {Array.from({ length: STROKE_MAX + 1 }, (_, j) => {
            const labelFrac = direction === "rtl" ? (j + 1) / 7 : j / 7;
            return (
              <span
                key={j}
                className="absolute -translate-x-1/2 text-[9px] font-semibold tabular-nums text-slate-300"
                style={{
                  left: `${(TRACK_PAD_FRAC + labelFrac * (1 - 2 * TRACK_PAD_FRAC)) * 100}%`,
                }}
              >
                {labelAtIndex(j)}
              </span>
            );
          })}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-7 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-slate-200/90 bg-white shadow-md ring-1 ring-black/15"
          style={{ left: `${thumbPct}%` }}
        />
      </div>
    </div>
  );
}

type RailTimeTrackPropsEx = {
  railCount: number;
  onRailSpeed: (v: number) => void;
  active: boolean;
  onActivate: () => void;
};

const RAIL_TIME_POSITIONS = [0, 0.25, 0.5, 0.75, 1] as const;

/** ?덉씪 ?ъ깮 ?띾룄(?쒓컙) 1~5 ?뺤닔 ??嫄곕━? 臾닿? */
function RailSpeedArrowTrack({ railCount, onRailSpeed, active, onActivate }: RailTimeTrackPropsEx) {
  const baseGradId = useId().replace(/:/g, "");
  const trackRef = useRef<HTMLDivElement>(null);
  const rs = Math.max(1, Math.min(5, Math.round(railCount)));
  const innerFrac = RAIL_TIME_POSITIONS[rs - 1]!;
  const thumbFrac = TRACK_PAD_FRAC + innerFrac * (1 - 2 * TRACK_PAD_FRAC);
  const thumbPct = thumbFrac * 100;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let t = (clientX - r.left) / r.width;
      t = Math.max(0, Math.min(1, t));
      const inner = (t - TRACK_PAD_FRAC) / (1 - 2 * TRACK_PAD_FRAC);
      let bestR = 3;
      let bestErr = Infinity;
      for (let i = 0; i < RAIL_TIME_POSITIONS.length; i++) {
        const err = Math.abs(inner - RAIL_TIME_POSITIONS[i]!);
        if (err < bestErr - 1e-9) {
          bestErr = err;
          bestR = i + 1;
        }
      }
      onRailSpeed(bestR);
    },
    [onRailSpeed]
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      onActivate();
      e.currentTarget.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
    },
    [setFromClientX, onActivate]
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      setFromClientX(e.clientX);
    },
    [setFromClientX]
  );

  const handleRailTimeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 2 : 1;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onActivate();
        onRailSpeed(Math.max(1, rs - step));
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onActivate();
        onRailSpeed(Math.min(5, rs + step));
      }
    },
    [onActivate, onRailSpeed, rs]
  );

  return (
    <div
      className={`overflow-visible rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 ${
        active ? "ring-1 ring-cyan-400/55 ring-offset-1 ring-offset-slate-900/80" : ""
      }`}
      tabIndex={0}
      role="slider"
      aria-label="레일거리"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={rs}
      onClick={() => onActivate()}
      onFocus={() => onActivate()}
      onKeyDown={handleRailTimeKeyDown}
    >
      <p className="mb-1 text-center text-[10px] font-medium text-slate-300">레일거리</p>
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        onPointerCancel={(e) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        }}
        className="relative h-10 w-full cursor-pointer touch-manipulation"
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={baseGradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgb(56 189 248 / 0.35)" />
              <stop offset="50%" stopColor="rgb(51 65 85 / 0.25)" />
              <stop offset="100%" stopColor="rgb(56 189 248 / 0.35)" />
            </linearGradient>
          </defs>
          <path
            d={ARROW_TRACK_PATH_RIGHT}
            fill={`url(#${baseGradId})`}
            stroke="rgb(255 255 255 / 0.14)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `inset(0 ${Math.max(0, 100 - thumbPct)}% 0 0)` }}
        >
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d={ARROW_TRACK_PATH_RIGHT} fill={SLIDER_GLOW_FILL} stroke="none" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-0">
          {RAIL_TIME_POSITIONS.map((fr, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40"
              style={{
                left: `${(TRACK_PAD_FRAC + fr * (1 - 2 * TRACK_PAD_FRAC)) * 100}%`,
              }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 top-[calc(50%+0.45rem)]">
          {[1, 2, 3, 4, 5].map((n, j) => (
            <span
              key={n}
              className="absolute -translate-x-1/2 text-[9px] font-semibold tabular-nums text-slate-300"
              style={{
                left: `${(TRACK_PAD_FRAC + RAIL_TIME_POSITIONS[j]! * (1 - 2 * TRACK_PAD_FRAC)) * 100}%`,
              }}
            >
              {n}
            </span>
          ))}
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-7 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-slate-200/90 bg-white shadow-md ring-1 ring-black/15"
          style={{ left: `${thumbPct}%` }}
        />
      </div>
    </div>
  );
}

export type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
  value?: SolutionSettingsValue;
  defaultValue?: Partial<SolutionSettingsValue>;
  onChange?: (next: SolutionSettingsValue) => void;
  defaultCueSide?: CueSide;
  onRequestOpen?: () => void;
  showMobileThumbnail?: boolean;
  /** ?⑤꼸 ?대┫ ???대떦 ??ぉ?쇰줈 吏꾩엯(?섎떒 ?붿빟 諛??? */
  focusSectionOnOpen?: null | "thickness" | "tip" | "rail";
};

export function SettingsPanel({
  open,
  onClose,
  className = "",
  value,
  defaultValue,
  onChange,
  defaultCueSide = "left",
  onRequestOpen,
  showMobileThumbnail = true,
  focusSectionOnOpen = null,
}: SettingsPanelProps) {
  const [tipEditMode, setTipEditMode] = useState(false);
  /** true: ?섍뎄/鍮④컙怨???룹닔援??쒕옒洹??깆쑝濡??먭퍡留?議곗젅 以???媛?대뱶쨌?뱀젏 ?쒖떆 ?④? */
  const [thicknessUiActive, setThicknessUiActive] = useState(false);
  const [activeControl, setActiveControl] = useState<null | "back" | "follow" | "rail">(null);
  const [internal, setInternal] = useState<SolutionSettingsValue>(() =>
    mergeSolutionSettings(
      {
        ...defaultValue,
        cueSide: defaultValue?.cueSide ?? defaultCueSide,
      },
      DEFAULT_SOLUTION_SETTINGS
    )
  );

  const current: SolutionSettingsValue = useMemo(() => {
    if (value !== undefined) {
      return mergeSolutionSettings(value, DEFAULT_SOLUTION_SETTINGS);
    }
    return internal;
  }, [value, internal]);

  const emit = useCallback(
    (partial: Partial<SolutionSettingsValue>) => {
      const next = mergeSolutionSettings(partial, current);
      if (value === undefined) {
        setInternal(next);
      }
      onChange?.(next);
    },
    [current, value, onChange]
  );

  /** 鍮꾩젣?? ?⑤꼸?????뚮쭏???섍뎄쨌鍮④컙 怨??먮몮??留욌떯??16/16), 寃뱀묠 ?놁쓬 */
  useEffect(() => {
    if (!open || value !== undefined) return;
    setInternal((prev) =>
      mergeSolutionSettings(
        {
          cueSide: "left",
          thicknessStep: PANEL_DEFAULT_TOUCHING_THICKNESS_STEP,
          fineDx: 0,
          fineDy: 0,
          backstroke: 0,
        },
        prev
      )
    );
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      setActiveControl(null);
      setThicknessUiActive(false);
      setTipEditMode(false);
      return;
    }
    miniArenaRef.current?.focus({ preventScroll: true });
    if (focusSectionOnOpen === "thickness") {
      setThicknessUiActive(true);
      setTipEditMode(false);
      setActiveControl(null);
    } else if (focusSectionOnOpen === "tip") {
      setTipEditMode(true);
      setThicknessUiActive(false);
      setActiveControl(null);
    } else if (focusSectionOnOpen === "rail") {
      setActiveControl("rail");
      setThicknessUiActive(false);
      setTipEditMode(false);
    } else {
      setThicknessUiActive(false);
      setTipEditMode(false);
      setActiveControl(null);
    }
  }, [open, focusSectionOnOpen]);

  useEffect(() => {
    return () => {
      if (cueSingleTapToThicknessTimerRef.current) {
        clearTimeout(cueSingleTapToThicknessTimerRef.current);
        cueSingleTapToThicknessTimerRef.current = null;
      }
    };
  }, []);

  const { thicknessStep, cueSide, tipNorm, railCount, backstroke, followStroke, fineDx, fineDy } =
    current;

  const isMobileDock = useIsMobileViewport();

  const lastTapRef = useRef<number>(0);
  const cueSingleTapToThicknessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const miniArenaRef = useRef<HTMLDivElement>(null);
  const tipOverlayRef = useRef<HTMLDivElement>(null);
  const cueTipEditorRef = useRef<HTMLDivElement>(null);
  const tipDraggingRef = useRef(false);
  const cueInteractRef = useRef<{
    active: boolean;
    moved: boolean;
    startPointerX: number;
    startLayoutDx: number;
  } | null>(null);

  const bounds = useMemo(() => discreteCueLayoutDxRange(), []);
  const discreteCueLayouts = useMemo(() => listDiscreteCueLayoutDx(), []);

  const redCenter = useMemo(() => ({ x: ARENA_W / 2, y: ARENA_H / 2 }), []);

  const rawOffset = useMemo(
    () => cueCenterOffsetPxFromRed(thicknessStep, cueSide, fineDx, fineDy),
    [thicknessStep, cueSide, fineDx, fineDy]
  );

  const cueCenter = useMemo(
    () => ({
      x: redCenter.x + rawOffset.dx * BALL_SCALE,
      y: redCenter.y + rawOffset.dy * BALL_SCALE,
    }),
    [redCenter.x, redCenter.y, rawOffset.dx, rawOffset.dy]
  );

  /** ?섍뎄쨌鍮④컙怨??먯씠 援먯감???뚮쭔 ?댁쨷 ?덉씠???꾨옒/?? + ?대┰ ??醫뚰몴쨌?쒕옒洹몃뒗 ?⑥씪 ?섍뎄 湲곗? ?좎? */
  const cueOverlapsRed = useMemo(() => {
    const dx = cueCenter.x - redCenter.x;
    const dy = cueCenter.y - redCenter.y;
    return Math.hypot(dx, dy) < 2 * BALL_R - 1e-3;
  }, [cueCenter.x, cueCenter.y, redCenter.x, redCenter.y]);

  const topCueClipPath = useMemo(() => {
    if (!cueOverlapsRed) return undefined;
    const cx = redCenter.x - cueCenter.x + BALL_R;
    const cy = redCenter.y - cueCenter.y + BALL_R;
    return `circle(${BALL_R}px at ${cx}px ${cy}px)`;
  }, [cueOverlapsRed, redCenter.x, redCenter.y, cueCenter.x, cueCenter.y]);

  const onBallImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error("image load failed:", e.currentTarget.src);
  }, []);

  const onCuePointerUp = useCallback(() => {
    const now = performance.now();
    if (now - lastTapRef.current < 320) {
      if (cueSingleTapToThicknessTimerRef.current) {
        clearTimeout(cueSingleTapToThicknessTimerRef.current);
        cueSingleTapToThicknessTimerRef.current = null;
      }
      setTipEditMode((v) => !v);
      setThicknessUiActive(false);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    if (cueSingleTapToThicknessTimerRef.current) {
      clearTimeout(cueSingleTapToThicknessTimerRef.current);
    }
    cueSingleTapToThicknessTimerRef.current = setTimeout(() => {
      cueSingleTapToThicknessTimerRef.current = null;
      setThicknessUiActive(true);
      lastTapRef.current = 0;
    }, 320);
  }, []);

  const onCueThicknessPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (tipEditMode || e.button !== 0) return;
      e.preventDefault();
      if (cueSingleTapToThicknessTimerRef.current) {
        clearTimeout(cueSingleTapToThicknessTimerRef.current);
        cueSingleTapToThicknessTimerRef.current = null;
      }
      setThicknessUiActive(true);
      setActiveControl(null);
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const layoutDx = rawOffset.dx;
      cueInteractRef.current = {
        active: true,
        moved: false,
        startPointerX: e.clientX,
        startLayoutDx: layoutDx,
      };
    },
    [tipEditMode, rawOffset.dx]
  );

  const onCueThicknessPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = cueInteractRef.current;
      if (!st?.active || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      if (Math.abs(e.clientX - st.startPointerX) > 3) st.moved = true;
      const dxClient = e.clientX - st.startPointerX;
      const targetLayoutDx = st.startLayoutDx + dxClient / BALL_SCALE;
      const inArena = clampLayoutDxToMiniArena(targetLayoutDx, ARENA_W, BALL_DISPLAY_PX, PANEL_LAYOUT_REF_BALL_PX);
      const clamped = Math.max(bounds.min, Math.min(bounds.max, inArena));
      emit(snapCueLayoutToDiscreteDx(clamped));
    },
    [emit, bounds.min, bounds.max]
  );

  const onCueThicknessPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = cueInteractRef.current;
      cueInteractRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (st?.active && !st.moved) {
        onCuePointerUp();
      }
    },
    [onCuePointerUp]
  );

  const updateTipFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = tipOverlayRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const maxR = BALL_R * TIP_MAX_FRAC;
      let dx = (clientX - cx) / maxR;
      let dy = (clientY - cy) / maxR;
      const c = clampToUnitDisk(dx, dy);
      emit({ tipNorm: c });
    },
    [emit]
  );

  const onTipOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      tipDraggingRef.current = true;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      updateTipFromClient(e.clientX, e.clientY);
    },
    [updateTipFromClient]
  );

  const onTipOverlayPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!tipDraggingRef.current) return;
      updateTipFromClient(e.clientX, e.clientY);
    },
    [updateTipFromClient]
  );

  const onTipOverlayPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tipDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const resetTipToCenter = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    emit({ tipNorm: { x: 0, y: 0 } });
    setTipEditMode(false);
    setThicknessUiActive(false);
  }, [emit]);

  const nudgeCueDiscrete = useCallback(
    (dir: -1 | 1) => {
      const idx = indexOfNearestDiscreteCueDx(rawOffset.dx, discreteCueLayouts);
      const next = discreteCueLayouts[idx + dir];
      if (!next) return;
      emit({
        cueSide: next.cueSide,
        thicknessStep: next.thicknessStep,
        fineDx: 0,
        fineDy: 0,
      });
    },
    [rawOffset.dx, discreteCueLayouts, emit]
  );

  const applySharedArrow = useCallback(
    (dir: -1 | 1) => {
      if (tipEditMode) return;
      if (activeControl === "back") {
        emit({ backstroke: Math.max(0, Math.min(STROKE_MAX, backstroke - dir)) });
        return;
      }
      if (activeControl === "follow") {
        emit({ followStroke: Math.max(0, Math.min(STROKE_MAX, followStroke + dir)) });
        return;
      }
      
      if (activeControl === "rail") {
        const next = Math.max(1, Math.min(5, Math.round(railCount) + dir));
        emit({ railCount: next });
        return;
      }
      nudgeCueDiscrete(dir);
    },
    [tipEditMode, activeControl, backstroke, followStroke, railCount, emit, nudgeCueDiscrete]
  );

  const railDisplayInt = Math.max(1, Math.min(5, Math.round(railCount)));

  const centerStatusText = useMemo(() => {
    if (tipEditMode) return "당점설정중";
    if (activeControl === "back") {
      const v = Math.max(0, Math.min(STROKE_MAX, Math.round(backstroke)));
      return `백스트로크 ${v}/${STROKE_MAX}`;
    }
    if (activeControl === "follow") {
      const v = Math.max(0, Math.min(STROKE_MAX, Math.round(followStroke)));
      return `팔로우스트로크 ${v}/${STROKE_MAX}`;
    }
    
    if (activeControl === "rail") {
      return `레일거리 ${railDisplayInt}/5`;
    }
    const t = thicknessDisplayStep16(thicknessStep);
    if (thicknessUiActive) return `두께 설정 ${t}/16`;
    return `두께 ${t}/16`;
  }, [
    tipEditMode,
    activeControl,
    backstroke,
    followStroke,
    thicknessStep,
    railDisplayInt,
        thicknessUiActive,
  ]);

  const onArenaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (tipEditMode) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        applySharedArrow(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        applySharedArrow(1);
      }
    },
    [tipEditMode, applySharedArrow]
  );

  const handleSaveClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const showCenterModal = !isMobileDock && open;
  const showMobileSheet = isMobileDock && open;

  /** early return ?댁쟾???먯뼱 Hook 媛쒖닔媛 ?뚮뜑留덈떎 ?숈씪?섎룄濡??좎? */
  const thumbTip = Math.hypot(tipNorm.x, tipNorm.y) > 0.06;
  /** ?뱀젏 ?몄쭛 以묒씠嫄곕굹 ?먭퍡 ?꾩슜 UI媛 ?꾨땺 ?뚮쭔 諛⑹궗??媛?대뱶 SVG */
  const cueBallImgSrc =
    tipEditMode || !thicknessUiActive ? IMG_BALL_WHITE : IMG_BALL_WHITE_NO_GUIDE;

  const cueTipZoomStyle = useMemo(
    (): CSSProperties => ({
      transformOrigin: "center center",
      transition: `transform ${CUE_TIP_EDIT_TRANSITION_MS}ms ease-out`,
      transform: tipEditMode ? `scale(${CUE_TIP_EDIT_SCALE})` : "scale(1)",
    }),
    [tipEditMode]
  );
  /** ?뱀젏 紐⑤뱶?먯꽌???쒖떆???뺣? ?섍뎄留?以묒븰 湲곗??쇰줈 ?뚮뜑(?ㅼ젣 醫뚰몴/臾쇰━???좎?) */
  const cueDisplayCenter = tipEditMode ? redCenter : cueCenter;
  const showCueSplitLayers = cueOverlapsRed && !tipEditMode;
  const onMiniArenaPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!tipEditMode) return;
      const target = e.target as Node | null;
      const editor = cueTipEditorRef.current;
      if (target && editor && !editor.contains(target)) {
        tipDraggingRef.current = false;
        setTipEditMode(false);
      }
    },
    [tipEditMode]
  );

  if (!isMobileDock && !open) return null;

  const renderMainPanelBody = () => (
    <>
      <div
        ref={miniArenaRef}
        className="relative mx-auto flex w-full flex-col items-center justify-center overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        style={{ minHeight: ARENA_H }}
        data-settings-mini-arena
        tabIndex={0}
        onKeyDown={onArenaKeyDown}
        onPointerDownCapture={onMiniArenaPointerDownCapture}
      >
        <div
          className="relative shrink-0 overflow-visible"
          style={{ width: ARENA_W, height: ARENA_H }}
        >
          {showCueSplitLayers && (
            <div
              className="pointer-events-none absolute"
              style={{
                ...cueTipZoomStyle,
                left: cueDisplayCenter.x - BALL_R,
                top: cueDisplayCenter.y - BALL_R,
                width: BALL_DISPLAY_PX,
                height: BALL_DISPLAY_PX,
                zIndex: tipEditMode ? 50 : 3,
              }}
            >
              <img
                src={cueBallImgSrc}
                alt=""
                width={BALL_DISPLAY_PX}
                height={BALL_DISPLAY_PX}
                draggable={false}
                onError={onBallImgError}
                className="h-full w-full object-contain select-none opacity-100"
              />
            </div>
          )}
          <div
            className="pointer-events-none absolute z-[5]"
            style={{
              left: redCenter.x - BALL_R,
              top: redCenter.y - BALL_R,
              width: BALL_DISPLAY_PX,
              height: BALL_DISPLAY_PX,
            }}
          >
            <img
              src={IMG_BALL_RED}
              alt=""
              width={BALL_DISPLAY_PX}
              height={BALL_DISPLAY_PX}
              draggable={false}
              onError={onBallImgError}
              className="pointer-events-none h-full w-full select-none object-contain drop-shadow-md"
            />
          </div>
          <button
            type="button"
            className="absolute z-[6] cursor-pointer touch-manipulation rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            style={{
              left: redCenter.x - BALL_R,
              top: redCenter.y - BALL_R,
              width: BALL_DISPLAY_PX,
              height: BALL_DISPLAY_PX,
            }}
            aria-label="두께 설정"
            onClick={(e) => {
              e.stopPropagation();
              if (cueSingleTapToThicknessTimerRef.current) {
                clearTimeout(cueSingleTapToThicknessTimerRef.current);
                cueSingleTapToThicknessTimerRef.current = null;
              }
              setThicknessUiActive(true);
              setActiveControl(null);
              setTipEditMode(false);
            }}
          />
          {showCueSplitLayers && (
            <div
              className="pointer-events-none absolute"
              style={{
                ...cueTipZoomStyle,
                left: cueDisplayCenter.x - BALL_R,
                top: cueDisplayCenter.y - BALL_R,
                width: BALL_DISPLAY_PX,
                height: BALL_DISPLAY_PX,
                clipPath: topCueClipPath,
                zIndex: tipEditMode ? 50 : 10,
              }}
            >
              <img
                src={cueBallImgSrc}
                alt=""
                width={BALL_DISPLAY_PX}
                height={BALL_DISPLAY_PX}
                draggable={false}
                onError={onBallImgError}
                className="h-full w-full object-contain select-none opacity-60"
              />
            </div>
          )}
          <div
            className="absolute"
            style={{
              ...cueTipZoomStyle,
              left: cueDisplayCenter.x - BALL_R,
              top: cueDisplayCenter.y - BALL_R,
              width: BALL_DISPLAY_PX,
              height: BALL_DISPLAY_PX,
              zIndex: tipEditMode ? 50 : 20,
            }}
            ref={cueTipEditorRef}
          >
            <div className="relative h-full w-full">
              {!showCueSplitLayers && (
                <img
                  src={cueBallImgSrc}
                  alt=""
                  width={BALL_DISPLAY_PX}
                  height={BALL_DISPLAY_PX}
                  draggable={false}
                  onError={onBallImgError}
                  className="h-full w-full object-contain select-none"
                />
              )}
              {!tipEditMode && (
                <button
                  type="button"
                  className="absolute inset-0 z-20 cursor-grab touch-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-sky-400"
                  onPointerDown={onCueThicknessPointerDown}
                  onPointerMove={onCueThicknessPointerMove}
                  onPointerUp={onCueThicknessPointerUp}
                  onPointerCancel={onCueThicknessPointerUp}
                  aria-label="수구를 가로로 드래그하여 1/16 단계 이동, 좌우 화살표 버튼으로 1/16 단계 미세 조정"
                  data-cue-tip-edit-mode="0"
                />
              )}
              {tipEditMode && (
                <div
                  ref={tipOverlayRef}
                  className="absolute inset-0 z-30 cursor-crosshair touch-none rounded-full"
                  onPointerDown={onTipOverlayPointerDown}
                  onPointerMove={onTipOverlayPointerMove}
                  onPointerUp={onTipOverlayPointerUp}
                  onPointerCancel={onTipOverlayPointerUp}
                  role="presentation"
                  aria-label="당점 편집 영역"
                  data-cue-tip-edit-mode="1"
                  data-tip-norm-x={tipNorm.x.toFixed(4)}
                  data-tip-norm-y={tipNorm.y.toFixed(4)}
                >
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 z-[45] px-1 py-0.5 text-[9px] text-amber-100"
                    onClick={resetTipToCenter}
                    aria-label="당점 중앙으로"
                  />
                </div>
              )}
              {(tipEditMode || (!thicknessUiActive && thumbTip)) && (
                <svg
                  className="pointer-events-none absolute inset-0 z-[40] h-full w-full"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <circle
                    cx={50 + tipNorm.x * 50 * TIP_MAX_FRAC}
                    cy={50 + tipNorm.y * 50 * TIP_MAX_FRAC}
                    r={TIP_MARK_RADIUS_VB}
                    fill="#6699ff"
                    stroke="#000000"
                    strokeWidth="0.55"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex w-full max-w-[340px] items-center justify-between gap-2 self-center px-0.5">
        <button
          type="button"
          disabled={tipEditMode}
          className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-md transition hover:bg-white/15 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          onClick={() => applySharedArrow(-1)}
          aria-label={
            tipEditMode
              ? "당점 설정 중에는 사용할 수 없음"
              : activeControl === "back"
                ? "백스트로크 한 단계 증가"
                : activeControl === "follow"
                  ? "팔로우스트로크 한 단계 감소"
                  : activeControl === "rail"
                      ? "레일거리 한 단계 감소"
                      : "두께 1/16 단계 왼쪽"
          }
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-cyan-400/70 bg-slate-900/60 px-2 py-1.5 text-center text-sm font-semibold leading-snug text-amber-200 tabular-nums sm:text-[15px]"
          aria-live="polite"
        >
          {centerStatusText}
        </div>
        <button
          type="button"
          disabled={tipEditMode}
          className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-md transition hover:bg-white/15 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          onClick={() => applySharedArrow(1)}
          aria-label={
            tipEditMode
              ? "당점 설정 중에는 사용할 수 없음"
              : activeControl === "back"
                ? "백스트로크 한 단계 감소"
                : activeControl === "follow"
                  ? "팔로우스트로크 한 단계 증가"
                  : activeControl === "rail"
                      ? "레일거리 한 단계 증가"
                      : "두께 1/16 단계 오른쪽"
          }
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ArrowStrokeSlider
          label="백스트로크"
          value={backstroke}
          direction="rtl"
          tickVariant="hideLeft"
          onChange={(n) => emit({ backstroke: n })}
          aria-label="백스트로크"
          active={activeControl === "back"}
          onActivate={() => {
            setThicknessUiActive(false);
            setActiveControl("back");
          }}
        />
        <ArrowStrokeSlider
          label="팔로우스트로크"
          value={followStroke}
          direction="ltr"
          tickVariant="hideRight"
          onChange={(n) => emit({ followStroke: n })}
          aria-label="팔로우스트로크"
          active={activeControl === "follow"}
          onActivate={() => {
            setThicknessUiActive(false);
            setActiveControl("follow");
          }}
        />
      </div>

      <div className="mt-1.5 flex w-full flex-col items-center gap-1.5 overflow-visible">
        <div className="w-[min(100%,calc((100%-0.375rem)/2*1.2))] min-w-0 shrink-0">
          <RailSpeedArrowTrack
            railCount={railCount}
            onRailSpeed={(v) => emit({ railCount: Math.max(1, Math.min(5, Math.round(v))) })}
            active={activeControl === "rail"}
            onActivate={() => {
              setThicknessUiActive(false);
              setActiveControl("rail");
            }}
          />
        </div>
      </div>
      <label className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[12px] text-slate-100">
        <input
          type="checkbox"
          checked={Boolean(current.ignorePhysics)}
          onChange={(e) => emit({ ignorePhysics: e.currentTarget.checked })}
          className="h-4 w-4 accent-cyan-400"
        />
        <span>설정 적용없이 경로선대로 움직이기</span>
      </label>
    </>
  );

  return (
    <>
      {showMobileThumbnail && isMobileDock && !open && (
        <button
          type="button"
          className={`fixed left-1/2 z-[95] flex max-w-[min(100vw-1.5rem,20rem)] -translate-x-1/2 touch-manipulation items-center gap-2 rounded-2xl border border-white/15 bg-slate-900/50 py-2 pl-2 pr-4 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition active:scale-[0.98] ${className}`}
          style={{
            bottom: "max(5.75rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))",
          }}
          aria-label="설정 열기"
          data-settings-dock-thumbnail="1"
          onClick={() => onRequestOpen?.()}
        >
          <div className="relative h-10 w-[4.5rem] shrink-0 overflow-visible" aria-hidden>
            <div
              className="absolute z-[5]"
              style={{
                width: 11,
                height: 11,
                left: redCenter.x * (72 / ARENA_W) - 5.5,
                top: redCenter.y * (40 / ARENA_H) - 5.5,
              }}
            >
              <img
                src={IMG_BALL_RED}
                alt=""
                width={11}
                height={11}
                draggable={false}
                onError={onBallImgError}
                className="h-full w-full object-contain"
              />
            </div>
            <div
              className="absolute z-20"
              style={{
                width: 11,
                height: 11,
                left: cueCenter.x * (72 / ARENA_W) - 5.5,
                top: cueCenter.y * (40 / ARENA_H) - 5.5,
              }}
            >
              <img
                src={IMG_BALL_WHITE_NO_GUIDE}
                alt=""
                width={11}
                height={11}
                draggable={false}
                onError={onBallImgError}
                className="h-full w-full object-contain"
              />
            </div>
            {thumbTip && (
              <span
                className="pointer-events-none absolute h-2 w-2 rounded-full border border-black bg-[#6699ff] shadow-sm"
                style={{
                  left: `calc(50% + ${tipNorm.x * 5.5 * CUE_TIP_NORM_DISPLAY_FRAC}px)`,
                  top: `calc(50% + ${tipNorm.y * 5.5 * CUE_TIP_NORM_DISPLAY_FRAC}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">설정</span>
            <span className="truncate font-mono text-sm text-white tabular-nums">R{railDisplayInt}</span>
          </div>
        </button>
      )}

      {showCenterModal && (
        <div
          className={`fixed inset-0 z-[100] flex items-end justify-center p-2 pb-4 sm:items-center sm:p-3 ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-panel-title"
          data-solution-settings-panel="1"
          data-settings-cue-side={cueSide}
          data-settings-thickness-step={thicknessStep}
          data-settings-tip-norm={`${tipNorm.x.toFixed(4)},${tipNorm.y.toFixed(4)}`}
          data-settings-rail-count={String(railCount)}
          data-settings-backstroke={String(backstroke)}
          data-settings-follow-stroke={String(followStroke)}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="닫기"
            onClick={onClose}
          />
          <div
            className="relative z-[101] flex min-h-[min(28rem,88vh)] w-full max-w-[20rem] flex-col overflow-hidden rounded-2xl border border-sky-300/25 bg-gradient-to-b from-sky-900/55 to-slate-900/50 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)" }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5">
              <h2
                id="settings-panel-title"
                className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-white"
              >
                <span>설정</span>
                <span className="text-[11px] font-normal text-slate-400">(수구더블탭시 당점설정)</span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 hover:bg-white/15"
                aria-label="설정 닫기"
              >
                <span aria-hidden>✕</span>
              </button>
            </header>

            <div className="overflow-hidden px-3 py-3">{renderMainPanelBody()}</div>

            <div className="flex shrink-0 justify-center border-t border-white/10 bg-sky-950/30 px-3 py-2.5">
              <button
                type="button"
                className="w-full max-w-[14rem] rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-sky-700 active:scale-[0.99]"
                onClick={handleSaveClose}
              >
                설정저장
              </button>
            </div>
          </div>
        </div>
      )}

      {showMobileSheet && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-3 ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-sheet-title"
          data-solution-settings-panel="1"
          data-settings-cue-side={cueSide}
          data-settings-thickness-step={thicknessStep}
          data-settings-tip-norm={`${tipNorm.x.toFixed(4)},${tipNorm.y.toFixed(4)}`}
          data-settings-rail-count={String(railCount)}
          data-settings-backstroke={String(backstroke)}
          data-settings-follow-stroke={String(followStroke)}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200"
            aria-label="설정 닫기"
            onClick={onClose}
          />
          <div className="relative z-[101] flex w-full max-w-[20rem] max-h-[82vh] min-h-[min(26rem,82vh)] flex-col overflow-hidden rounded-2xl border border-sky-300/25 bg-gradient-to-b from-sky-900/55 to-slate-900/50 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5">
              <h2
                id="settings-sheet-title"
                className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-white"
              >
                <span>설정</span>
                <span className="text-[11px] font-normal text-slate-400">(수구더블탭시 당점설정)</span>
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 hover:bg-white/15"
                aria-label="설정 닫기"
              >
                <span aria-hidden>✕</span>
              </button>
            </header>
            <div className="overflow-hidden px-3 py-3 pb-1">{renderMainPanelBody()}</div>
            <div className="flex shrink-0 justify-center border-t border-white/10 bg-sky-950/30 px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="w-full max-w-[14rem] rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-sky-700 active:scale-[0.99]"
                onClick={handleSaveClose}
              >
                설정저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}







