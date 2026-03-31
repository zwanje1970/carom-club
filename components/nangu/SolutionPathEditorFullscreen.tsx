"use client";

/**
 * 寃쎈줈(?섍뎄쨌1紐? ?몄쭛 ?꾩슜 ?꾩껜?붾㈃ ???ㅽ뙚/以??ъ깮? ?ш린?쒕쭔 (誘몃━蹂닿린??蹂닿린 ?꾩슜).
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TableDrawStyle } from "@/components/billiard";
import { PathPlaybackViewOverlay } from "@/components/nangu/PathPlaybackViewOverlay";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import {
  SolutionTableZoomShell,
  type SolutionTablePanPointerPolicy,
  type SolutionTableZoomShellApi,
} from "@/components/nangu/SolutionTableZoomShell";
import { useBallPlacementFullscreen } from "@/components/community/BallPlacementFullscreenContext";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import type { SolutionTableZoomContextValue } from "@/components/nangu/solution-table-zoom-context";
import {
  getPlayfieldRect,
  pixelToNormalized,
  isInsidePlayfield,
  portraitToLandscapeNorm,
  distanceNormPointsInPlayfieldPx,
  pathAutoChainNearCushionMaxDistancePx,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguCurveNode,
  type NanguPathPoint,
} from "@/lib/nangu-types";
import {
  cloneNanguCurveNodes,
  pruneCuePathCurveNodes,
  pruneObjectPathCurveNodes,
} from "@/lib/nangu-curve-nodes";
import {
  resolveEffectiveFirstObjectCollisionFromCuePath,
  resolveEffectiveSecondObjectCollisionFromPaths,
} from "@/lib/solution-path-geometry";
import {
  appendCuePathSpot,
  appendCuePathSpotWithAim,
  insertCuePathSpot,
  insertCuePathSpotWithAim,
  moveCuePathSpotById,
  cuePathAppendWouldDuplicateExistingSpot,
  snapCuePathTap,
  snapObjectPathPlayfieldTap,
  snapToPlayfieldCushionJunction,
  stripInvalidEndSpots,
  isLastSegmentEndpointSpotIndex,
  type CuePathRayAppendContext,
  type CuePathSnapFn,
  type PathPointerAim,
} from "@/lib/cue-path-cushion-rules";
import {
  resolveObjectPathRayHitLandscape,
  landscapeNormToPlayfieldCanvasPx,
  tableCanvasClampedToPlayfieldLandscapeNorm,
} from "@/lib/cue-path-ray-resolve";
import { normalizeBallSpeed, type BallSpeed } from "@/lib/ball-speed-constants";
import { isTroublePlaybackVerboseLogEnabled } from "@/lib/trouble-playback-verbose-log";
import { useSolutionPathPlayback } from "@/hooks/useSolutionPathPlayback";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";
import { CollisionWarningToast } from "@/components/trouble/CollisionWarningToast";
import { sanitizeImageSrc } from "@/lib/image-src";
import {
  classifySolutionPathPointerHit,
  isClassificationEmptyForPan,
} from "@/lib/solution-path-pointer-classify";
import { isPathTooCloseToNonCueBalls } from "@/lib/solution-path-ball-clearance";
import {
  type PathSegmentCurveControl,
  clonePathCurveControls,
  pruneCuePathCurveControls,
  pruneObjectPathCurveControls,
} from "@/lib/path-curve-display";
import { cx } from "@/components/client/console/ui/cx";
import { SettingsPanel, type SolutionSettingsValue } from "@/components/ui/SettingsPanel";
import {
  CUE_TIP_NORM_DISPLAY_FRAC,
  thicknessDisplayOverlapStep16,
} from "@/lib/solution-panel-ball-layout";


/** nangu??1紐?寃쎈줈 ?놁쓬. 留??뚮뜑 `[]`瑜??섍린硫??ъ깮 ?낆쓽 ?섏〈?깆씠 諛붾뚯뼱 留ㅻ쾲 reset?섏뼱 ?좊땲硫붿씠?섏씠 ?숈옉?섏? ?딆쓬 */
const EMPTY_NANGU_OBJECT_PATH_POINTS: NanguPathPoint[] = [];

const MAX_PATH_EDITOR_UNDO = 10;
/** ?몄젒 吏??異붽? ?덉슜: ?꾩쟾 以묐났 ??嫄곗쓽 媛숈? ??留?李⑤떒 */
const SPOT_APPEND_DUP_THRESHOLD_PX = 3;
/** 한 탭에서 오버레이 pointerdown + 확대 뷰 onEmptyTap 등으로 동일 좌표가 연속 추가되는 것 방지 */
const CUE_PLAYFIELD_APPEND_DEBOUNCE_MS = 120;

function cuePlayfieldAppendDedupeKey(norm: { x: number; y: number }) {
  return `${norm.x.toFixed(5)},${norm.y.toFixed(5)}`;
}

function arePathPointsEqual(a: NanguPathPoint[], b: NanguPathPoint[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.id !== y.id || x.x !== y.x || x.y !== y.y || x.type !== y.type) return false;
  }
  return true;
}

function areCurveControlsEqual(a: PathSegmentCurveControl[], b: PathSegmentCurveControl[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.key !== y.key || x.x !== y.x || x.y !== y.y) return false;
  }
  return true;
}

function areNanguCurveNodesEqual(a: NanguCurveNode[], b: NanguCurveNode[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.segmentKey !== y.segmentKey || x.x !== y.x || x.y !== y.y) return false;
  }
  return true;
}

const UNDO_LIMIT_TOAST_MS = 500;

function CloseXIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function UndoStrokeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11"
      />
    </svg>
  );
}

type PathEditorPairSnapshot = {
  cue: NanguPathPoint[];
  obj: NanguPathPoint[];
  obj2: NanguPathPoint[];
  cueCurves?: PathSegmentCurveControl[];
  objCurves?: PathSegmentCurveControl[];
  cueCurveNodes?: NanguCurveNode[];
  objCurveNodes?: NanguCurveNode[];
};

function clonePathPointsForUndo(pts: NanguPathPoint[]): NanguPathPoint[] {
  return pts.map((p) => ({ ...p }));
}

function clampCurveControlNorm(n: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.min(1, Math.max(0, n.x)), y: Math.min(1, Math.max(0, n.y)) };
}

/** ?쒓뎄(trouble)쨌nangu 怨듯넻 ??寃쎈줈 紐⑤뱶 ?좉? ?숈씪 ?ш린, ?쒖꽦 而щ윭 / 鍮꾪솢???묐갚 */
function pathLayerToggleClass(active: boolean, layer: "cue" | "object" | "object2") {
  return cx(
    "inline-flex h-10 w-[9rem] flex-shrink-0 items-center justify-center rounded-xl border-2 px-2 text-center text-[11px] font-semibold leading-snug transition-all duration-200 touch-manipulation shadow-sm sm:text-xs",
    active
      ? layer === "cue"
        ? "border-site-primary bg-site-primary/15 text-site-primary shadow-md ring-2 ring-site-primary/25 grayscale-0"
        : layer === "object"
          ? "border-sky-600 bg-sky-500/12 text-sky-900 shadow-md ring-2 ring-sky-500/20 grayscale-0 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-50"
          : "border-green-600 bg-green-500/12 text-green-900 shadow-md ring-2 ring-green-500/20 grayscale-0 dark:border-green-500 dark:bg-green-950/50 dark:text-green-50"
      : "border-zinc-200/95 bg-zinc-50 text-zinc-500 grayscale hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800/95 dark:text-zinc-400"
  );
}

function cueSpotToggleClass(on: boolean) {
  return cx(
    "inline-flex h-10 min-w-[5.25rem] flex-shrink-0 items-center justify-center rounded-xl border-2 px-2.5 text-center text-[11px] font-semibold transition-all duration-200 touch-manipulation shadow-sm sm:text-xs",
    on
      ? "border-site-primary/75 bg-site-primary/12 text-site-primary ring-2 ring-site-primary/20 grayscale-0"
      : "border-zinc-200 bg-zinc-50 text-zinc-500 grayscale dark:border-zinc-600 dark:bg-zinc-800/95 dark:text-zinc-400"
  );
}

const toolbarBtn =
  "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors touch-manipulation disabled:pointer-events-none disabled:opacity-45";
const toolbarGhost =
  "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
const toolbarPrimary =
  "border-site-primary bg-site-primary text-white shadow-md hover:brightness-105 active:brightness-95 dark:border-site-primary";
const toolbarDanger =
  "border-red-200 bg-red-50 text-red-700 hover:bg-red-100/90 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/80";
const toolbarAccent =
  "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100/90 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-100 dark:hover:bg-amber-950/70";

/** 하단 한 줄: 보이기·활성·설정~시연 동일 탭 높이(모바일 터치) */
const pathBarMiniBtn =
  "inline-flex h-9 min-h-9 shrink-0 items-center justify-center rounded-lg border-2 px-2 text-[11px] font-semibold leading-tight transition-colors touch-manipulation sm:text-xs disabled:pointer-events-none disabled:opacity-40 disabled:grayscale";

export type SolutionPathEditorPresentation = "overlay" | "noteBallPlacementFullscreen";

export type SolutionPathEditorFullscreenProps = {
  variant: "nangu" | "trouble";
  /** trouble: ?대?吏 諛곗튂留??덉쓣 ??null + layoutImageUrl */
  ballPlacement: NanguBallPlacement | null;
  /** ballPlacement 媛 null ?????쒓뎄 ?대?吏 ?먮낯) */
  layoutImageUrl?: string | null;
  /** ?대┫ ???ㅻ깄??(遺紐?key濡?由щ쭏?댄듃 ??珥덇린?? */
  initialPathPoints: NanguPathPoint[];
  initialObjectPathPoints: NanguPathPoint[];
  /** ?쒓뎄 ?쒖떆 ?꾩슜 怨≪꽑(??Β룸?由щ낫湲?蹂듭썝) */
  initialCuePathDisplayCurves?: PathSegmentCurveControl[];
  initialObjectPathDisplayCurves?: PathSegmentCurveControl[];
  initialCuePathCurveNodes?: NanguCurveNode[];
  initialObjectPathCurveNodes?: NanguCurveNode[];
  thicknessOffsetX: number;
  isBankShot: boolean;
  ballSpeed: BallSpeed;
  onConfirm: (payload: {
    pathPoints: NanguPathPoint[];
    objectPathPoints: NanguPathPoint[];
    cuePathDisplayCurves?: PathSegmentCurveControl[];
    objectPathDisplayCurves?: PathSegmentCurveControl[];
    cuePathCurveNodes?: NanguCurveNode[];
    objectPathCurveNodes?: NanguCurveNode[];
  }) => void;
  onCancel: () => void;
  /**
   * overlay: z-[200] ?쇰컲 紐⑤떖.
   * noteBallPlacementFullscreen: ?쒓뎄?명듃 怨듬같移??꾩껜?붾㈃怨??숈씪 ??z-[9999]쨌safe-area쨌?섎떒 ?ㅻ퉬 ?④?).
   */
  presentation?: SolutionPathEditorPresentation;
  /**
   * true: 怨?醫뚰몴쨌?섍뎄???곗씠??洹몃?濡?罹붾쾭?ㅻ뒗 ?대? ?쎄린 ?꾩슜). ?쒓뎄 ?대쾿?쒖떆?먮뒗?뚯닔援с띾쾭???먯껜瑜??④?.
   * ?쒓뎄?대쾿 ??臾몄젣??怨좎젙??諛곗튂瑜?????
   */
  readOnlyCueAndBalls?: boolean;
  /** ?대쾿 誘몃땲?⑤꼸 ?섍뎄 諛곗튂 ???ъ깮 以??ㅻ쾭?덉씠? 蹂묓빀(?ъ깮 ?곗꽑) */
  panelBallNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  panelCueTipNorm?: { x: number; y: number } | null;
  settingsValue?: SolutionSettingsValue;
  onSettingsChange?: (next: SolutionSettingsValue) => void;
  settingsOpen?: boolean;
  /** ??ぉ蹂?吏꾩엯 ??援ш컙 ?꾨떖 ???섎떒 ?붿빟怨??숈씪 `panelSettings`??遺紐⑤쭔 蹂닿? */
  onSettingsOpen?: (section?: "thickness" | "tip" | "rail") => void;
  onSettingsClose?: () => void;
  /** `SettingsPanel` 珥덇린 ?ъ빱????遺紐?`panelSettings`? ?⑥씪 ?뚯뒪 */
  settingsFocusSection?: null | "thickness" | "tip" | "rail";
};

export function SolutionPathEditorFullscreen({
  variant,
  ballPlacement,
  layoutImageUrl = null,
  initialPathPoints,
  initialObjectPathPoints,
  initialCuePathDisplayCurves = [],
  initialObjectPathDisplayCurves = [],
  initialCuePathCurveNodes = [],
  initialObjectPathCurveNodes = [],
  thicknessOffsetX,
  isBankShot,
  ballSpeed,
  onConfirm,
  onCancel,
  presentation = "overlay",
  readOnlyCueAndBalls = false,
  panelBallNormOverrides,
  panelCueTipNorm = null,
  settingsValue,
  onSettingsChange,
  settingsOpen = false,
  onSettingsOpen,
  onSettingsClose,
  settingsFocusSection = null,
}: SolutionPathEditorFullscreenProps) {
  if (variant === "nangu" && !ballPlacement) {
    throw new Error("SolutionPathEditorFullscreen: nangu variant requires ballPlacement");
  }
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>(initialPathPoints);
  const [objectPathPoints, setObjectPathPoints] = useState<NanguPathPoint[]>(initialObjectPathPoints);
  const [secondObjectPathPoints, setSecondObjectPathPoints] = useState<NanguPathPoint[]>([]);
  const [pathMode, setPathMode] = useState(true);
  const [objectPathMode, setObjectPathMode] = useState(false);
  const [secondObjectPathMode, setSecondObjectPathMode] = useState(false);
  /**
   * ?쒓뎄(trouble): ?섍뎄寃쎈줈 / 1?곴뎄寃쎈줈 ???숈떆 ?쒖꽦 遺덇?, ?숈떆 鍮꾪솢??媛???대븣 寃쎈줈??異붽? 遺덇?).
   * nangu??湲곗〈 pathMode쨌objectPathMode留??ъ슜.
   */
  const [troublePathEditLayer, setTroublePathEditLayer] = useState<"cue" | "object" | "object2" | null>("cue");
  /** ?ㅽ뙚 異붽?쨌?쎌엯쨌??젣쨌?쒕옒洹??대룞쨌?꾩껜 ??젣 吏곸쟾 ?ㅻ깄?????섎룎由ш린 1??= 吏곸쟾 ?숈옉 痍⑥냼 */
  const [pathUndoStack, setPathUndoStack] = useState<PathEditorPairSnapshot[]>([]);
  const pathPointsRef = useRef(pathPoints);
  const objectPathPointsRef = useRef(objectPathPoints);
  const secondObjectPathPointsRef = useRef(secondObjectPathPoints);
  useEffect(() => {
    pathPointsRef.current = pathPoints;
  }, [pathPoints]);
  useEffect(() => {
    objectPathPointsRef.current = objectPathPoints;
  }, [objectPathPoints]);
  useEffect(() => {
    secondObjectPathPointsRef.current = secondObjectPathPoints;
  }, [secondObjectPathPoints]);

  /** 확대 뷰 `pointerup`의 onEmptyTap 과 경로 오버레이 `pointerdown` 이중 추가 방지 */
  const suppressZoomEmptyTapPointerIdRef = useRef<number | null>(null);
  const lastCuePlayfieldAppendDedupeRef = useRef<{ t: number; key: string } | null>(null);
  const lastObjectPlayfieldAppendDedupeRef = useRef<{ t: number; key: string } | null>(null);
  const lastSecondObjectPlayfieldAppendDedupeRef = useRef<{ t: number; key: string } | null>(null);
  const onPathAppendPointerDown = useCallback((pointerId: number) => {
    suppressZoomEmptyTapPointerIdRef.current = pointerId;
  }, []);

  const [cuePathCurveControls, setCuePathCurveControls] = useState<PathSegmentCurveControl[]>(() =>
    clonePathCurveControls(initialCuePathDisplayCurves)
  );
  const [objectPathCurveControls, setObjectPathCurveControls] = useState<PathSegmentCurveControl[]>(
    () => clonePathCurveControls(initialObjectPathDisplayCurves)
  );
  const [cuePathCurveNodes, setCuePathCurveNodes] = useState<NanguCurveNode[]>(() =>
    cloneNanguCurveNodes(initialCuePathCurveNodes)
  );
  const [objectPathCurveNodes, setObjectPathCurveNodes] = useState<NanguCurveNode[]>(() =>
    cloneNanguCurveNodes(initialObjectPathCurveNodes)
  );
  /** ?쒓뎄: ?좊텇 ?붾툝??쓣 ?ㅽ뙚 ?쎌엯 ???怨≪꽑 ?몃뱶濡?*/
  const [troubleCurveEditMode, setTroubleCurveEditMode] = useState(true);
  const cueCurveControlsRef = useRef(cuePathCurveControls);
  const objectCurveControlsRef = useRef(objectPathCurveControls);
  const cueCurveNodesRef = useRef(cuePathCurveNodes);
  const objectCurveNodesRef = useRef(objectPathCurveNodes);
  useEffect(() => {
    cueCurveControlsRef.current = cuePathCurveControls;
  }, [cuePathCurveControls]);
  useEffect(() => {
    objectCurveControlsRef.current = objectPathCurveControls;
  }, [objectPathCurveControls]);
  useEffect(() => {
    cueCurveNodesRef.current = cuePathCurveNodes;
  }, [cuePathCurveNodes]);
  useEffect(() => {
    objectCurveNodesRef.current = objectPathCurveNodes;
  }, [objectPathCurveNodes]);

  useEffect(() => {
    setCuePathCurveControls((prev) => pruneCuePathCurveControls(prev, pathPoints));
    setObjectPathCurveControls((prev) => pruneObjectPathCurveControls(prev, objectPathPoints));
    setCuePathCurveNodes((prev) => pruneCuePathCurveNodes(prev, pathPoints));
    setObjectPathCurveNodes((prev) => pruneObjectPathCurveNodes(prev, objectPathPoints));
  }, [pathPoints, objectPathPoints]);

  const pushPathUndoSnapshot = useCallback((cueSnap: NanguPathPoint[], objSnap: NanguPathPoint[]) => {
    setPathUndoStack((s) => {
      const nextSnap: PathEditorPairSnapshot = {
        cue: clonePathPointsForUndo(cueSnap),
        obj: clonePathPointsForUndo(objSnap),
        obj2: clonePathPointsForUndo(secondObjectPathPointsRef.current),
        cueCurves: clonePathCurveControls(cueCurveControlsRef.current),
        objCurves: clonePathCurveControls(objectCurveControlsRef.current),
        cueCurveNodes: cloneNanguCurveNodes(cueCurveNodesRef.current),
        objCurveNodes: cloneNanguCurveNodes(objectCurveNodesRef.current),
      };
      const last = s[s.length - 1];
      if (
        last &&
        arePathPointsEqual(last.cue, nextSnap.cue) &&
        arePathPointsEqual(last.obj, nextSnap.obj) &&
        arePathPointsEqual(last.obj2 ?? [], nextSnap.obj2 ?? []) &&
        areCurveControlsEqual(last.cueCurves ?? [], nextSnap.cueCurves ?? []) &&
        areCurveControlsEqual(last.objCurves ?? [], nextSnap.objCurves ?? []) &&
        areNanguCurveNodesEqual(last.cueCurveNodes ?? [], nextSnap.cueCurveNodes ?? []) &&
        areNanguCurveNodesEqual(last.objCurveNodes ?? [], nextSnap.objCurveNodes ?? [])
      ) {
        return s;
      }
      return [...s.slice(-(MAX_PATH_EDITOR_UNDO - 1)), nextSnap];
    });
  }, []);

  /** ?ㅽ뙚 ?쒕옒洹?1??= ?섎룎由ш린 1???쒕옒洹??쒖옉 吏곸쟾 ?곹깭瑜??ㅽ깮?????. noop ?대룞???ы븿. */
  const onPathSpotDragStart = useCallback(
    (_kind: "cue" | "object" | "object2", _spotId: string) => {
      pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
    },
    [pushPathUndoSnapshot]
  );

  const onPathSpotDragEnd = useCallback(() => {}, []);

  const onCurveHandleDragBegin = useCallback(() => {
    pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
  }, [pushPathUndoSnapshot]);

  const upsertCueDisplayCurve = useCallback(
    (key: string, norm: { x: number; y: number }) => {
      pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
      const c = clampCurveControlNorm(norm);
      /** ?ъ깮? path-bezier媛 display ?쒖뼱?먯쓣 ?곕?濡? ??怨≪꽑? ?몃뱶留?梨꾩썙 吏곸꽑 ?ъ깮 ?좎? */
      setCuePathCurveControls((prev) => prev.filter((x) => x.key !== key));
      setCuePathCurveNodes((prev) => [
        ...prev.filter((n) => n.segmentKey !== key),
        { segmentKey: key, x: c.x, y: c.y },
      ]);
    },
    [pushPathUndoSnapshot]
  );

  const upsertObjectDisplayCurve = useCallback(
    (key: string, norm: { x: number; y: number }) => {
      pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
      const c = clampCurveControlNorm(norm);
      setObjectPathCurveControls((prev) => prev.filter((x) => x.key !== key));
      setObjectPathCurveNodes((prev) => [
        ...prev.filter((n) => n.segmentKey !== key),
        { segmentKey: key, x: c.x, y: c.y },
      ]);
    },
    [pushPathUndoSnapshot]
  );

  const moveCueDisplayCurve = useCallback((key: string, norm: { x: number; y: number }) => {
    const c = clampCurveControlNorm(norm);
    setCuePathCurveNodes((prev) => {
      if (!prev.some((n) => n.segmentKey === key)) return prev;
      return prev.map((n) => (n.segmentKey === key ? { ...n, ...c } : n));
    });
    setCuePathCurveControls((prev) => {
      if (!prev.some((x) => x.key === key)) return prev;
      return prev.map((x) => (x.key === key ? { ...x, ...c } : x));
    });
  }, []);

  const moveObjectDisplayCurve = useCallback((key: string, norm: { x: number; y: number }) => {
    const c = clampCurveControlNorm(norm);
    setObjectPathCurveNodes((prev) => {
      if (!prev.some((n) => n.segmentKey === key)) return prev;
      return prev.map((n) => (n.segmentKey === key ? { ...n, ...c } : n));
    });
    setObjectPathCurveControls((prev) => {
      if (!prev.some((x) => x.key === key)) return prev;
      return prev.map((x) => (x.key === key ? { ...x, ...c } : x));
    });
  }, []);

  const removeCueDisplayCurve = useCallback(
    (key: string) => {
      pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
      setCuePathCurveControls((prev) => prev.filter((x) => x.key !== key));
      setCuePathCurveNodes((prev) => prev.filter((n) => n.segmentKey !== key));
    },
    [pushPathUndoSnapshot]
  );

  const removeObjectDisplayCurve = useCallback(
    (key: string) => {
      pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
      setObjectPathCurveControls((prev) => prev.filter((x) => x.key !== key));
      setObjectPathCurveNodes((prev) => prev.filter((n) => n.segmentKey !== key));
    },
    [pushPathUndoSnapshot]
  );

  const straightenAllDisplayCurves = useCallback(() => {
    if (
      cuePathCurveControls.length === 0 &&
      objectPathCurveControls.length === 0 &&
      cuePathCurveNodes.length === 0 &&
      objectPathCurveNodes.length === 0
    ) {
      return;
    }
    pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
    setCuePathCurveControls([]);
    setObjectPathCurveControls([]);
    setCuePathCurveNodes([]);
    setObjectPathCurveNodes([]);
  }, [
    pushPathUndoSnapshot,
    cuePathCurveControls.length,
    objectPathCurveControls.length,
    cuePathCurveNodes.length,
    objectPathCurveNodes.length,
  ]);

  const [undoLimitToastVisible, setUndoLimitToastVisible] = useState(false);
  const undoLimitToastTimerRef = useRef<number | null>(null);

  const showUndoLimitToast = useCallback(() => {
    setUndoLimitToastVisible(true);
    if (undoLimitToastTimerRef.current != null) {
      window.clearTimeout(undoLimitToastTimerRef.current);
    }
    undoLimitToastTimerRef.current = window.setTimeout(() => {
      setUndoLimitToastVisible(false);
      undoLimitToastTimerRef.current = null;
    }, UNDO_LIMIT_TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (undoLimitToastTimerRef.current != null) {
        window.clearTimeout(undoLimitToastTimerRef.current);
      }
    },
    []
  );

  /** overlay 紐⑤뱶留?怨?????以?珥덉젏 ?대룞. note ?몄? ?쒓뎄?명듃 怨듬같移섏? 媛숈씠 ?뚮젅?댄븘??以묒떖 怨좎젙(?뚯씠釉붿씠 怨듭쓣 已볦븘 ?吏곸씠吏 ?딆쓬) */
  const [zoomFocusOverlay, setZoomFocusOverlay] = useState({
    x: DEFAULT_TABLE_WIDTH / 2,
    y: DEFAULT_TABLE_HEIGHT / 2,
  });
  const zoomCtxRef = useRef<SolutionTableZoomContextValue | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomShellApiRef = useRef<SolutionTableZoomShellApi | null>(null);

  const isNoteShell = presentation === "noteBallPlacementFullscreen";
  const ballPlacementFullscreen = useBallPlacementFullscreen();
  const deviceOrientation = useTableOrientation();
  /** PC쨌?쒕툝由??볦? 酉고룷??: 紐⑤컮??媛濡쒕쭔 ?쒖쇅?섍퀬 湲?蹂 ?몃줈 ?뚯씠釉붽낵 ?숈씪?섍쾶 留욎땄 */
  const [viewportMdUp, setViewportMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setViewportMdUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  /** ?명듃 ?? ?곗륫 ?щ씪?대뱶(?쒓뎄?명듃 怨듬같移섏? ?숈씪 ?꾩튂) ??寃쎈줈 ??젣쨌?좊땲硫붿씠?샕룸낫湲??ㅼ젙 */
  const [leftPathDrawerOpen, setLeftPathDrawerOpen] = useState(false);
  /** ?명듃 ?? ?곗륫 ?щ씪?대뱶 ??醫뚯륫怨??낅┰ 硫붾돱 ?곸뿭) */
  const [rightPathDrawerOpen, setRightPathDrawerOpen] = useState(false);
  /** nangu 노트 전체화면 좌측 드로어 드래그 닫기(trouble 좌측과 동시 마운트되지 않음) */
  const [leftPathDrawerDragPx, setLeftPathDrawerDragPx] = useState(0);
  const [leftPathDrawerDragging, setLeftPathDrawerDragging] = useState(false);
  const leftPathDrawerAsideRef = useRef<HTMLElement | null>(null);
  const leftPathDrawerDragRef = useRef<{ startX: number; basePx: number } | null>(null);
  const leftPathDrawerDragPxRef = useRef(0);
  /** ?쒓뎄(trouble): ?곗륫 ?⑤꼸???쒕옒洹몃줈 ?リ린 ???대┝ 湲곗? ?ㅻⅨ履쎌쑝濡?諛由?px(0=?꾩쟾???대┝) */
  const [troubleDrawerDragPx, setTroubleDrawerDragPx] = useState(0);
  const [troubleDrawerDragging, setTroubleDrawerDragging] = useState(false);
  const troubleDrawerAsideRef = useRef<HTMLElement | null>(null);
  const troubleDrawerDragRef = useRef<{ startX: number; basePx: number } | null>(null);
  const troubleDrawerDragPxRef = useRef(0);

  useEffect(() => {
    troubleDrawerDragPxRef.current = troubleDrawerDragPx;
  }, [troubleDrawerDragPx]);

  useEffect(() => {
    setTroubleDrawerDragPx(0);
  }, [rightPathDrawerOpen]);

  /** ?쒓뎄(trouble): 醫뚯륫 ?щ씪?대뱶 ?⑤꼸 ???곗륫 ?⑤꼸怨??移?*/
  const [troubleLeftDrawerOpen, setTroubleLeftDrawerOpen] = useState(false);
  const [troubleLeftDrawerDragPx, setTroubleLeftDrawerDragPx] = useState(0);
  const [troubleLeftDrawerDragging, setTroubleLeftDrawerDragging] = useState(false);
  const troubleLeftDrawerAsideRef = useRef<HTMLElement | null>(null);
  const troubleLeftDrawerDragRef = useRef<{ startX: number; basePx: number } | null>(null);
  const troubleLeftDrawerDragPxRef = useRef(0);
  const [pathSaveFeedback, setPathSaveFeedback] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [menuInfoFeedback, setMenuInfoFeedback] = useState<string | null>(null);

  useEffect(() => {
    troubleLeftDrawerDragPxRef.current = troubleLeftDrawerDragPx;
  }, [troubleLeftDrawerDragPx]);

  useEffect(() => {
    setTroubleLeftDrawerDragPx(0);
  }, [troubleLeftDrawerOpen]);

  useEffect(() => {
    leftPathDrawerDragPxRef.current = leftPathDrawerDragPx;
  }, [leftPathDrawerDragPx]);

  useEffect(() => {
    setLeftPathDrawerDragPx(0);
  }, [leftPathDrawerOpen]);

  const [tableGridOn, setTableGridOn] = useState(true);
  const [tableDrawStyle, setTableDrawStyle] = useState<TableDrawStyle>("realistic");
  const [cueSpotOn, setCueSpotOn] = useState(true);
  const [cueBallChoice, setCueBallChoice] = useState<"white" | "yellow">(
    ballPlacement?.cueBall ?? "white"
  );
  const [cuePickerOpen, setCuePickerOpen] = useState(false);
  /** 寃쎈줈 ?ㅽ뙚: 湲곕낯 留덉?留????ㅽ뙚留??쒖꽦 ???ㅻⅨ ?ㅽ뙚 ?붾툝?대┃ ???꾪솚(??긽 1媛? */
  const [cuePathActiveSpotId, setCuePathActiveSpotId] = useState<string | null>(null);
  const [objectPathActiveSpotId, setObjectPathActiveSpotId] = useState<string | null>(null);
  const [secondObjectPathActiveSpotId, setSecondObjectPathActiveSpotId] = useState<string | null>(null);

  useEffect(() => {
    if (ballPlacement?.cueBall) setCueBallChoice(ballPlacement.cueBall);
  }, [ballPlacement?.cueBall]);

  /** 醫뚰몴 諛곗튂媛 ?덉쓣 ???섍뎄 ?쒖떆 ??readOnly硫?寃뚯떆臾?臾몄젣??cueBall 怨좎젙 */
  const layoutForCue = useMemo((): NanguBallPlacement | null => {
    if (!ballPlacement) return null;
    if (readOnlyCueAndBalls) return ballPlacement;
    return { ...ballPlacement, cueBall: cueBallChoice };
  }, [ballPlacement, cueBallChoice, readOnlyCueAndBalls]);

  /**
   * 경로선 편집화면(isNoteShell)은 항상 portrait(짧은 변 가로, 긴 변 세로)로 표시하여
   * 화면을 최대한 활용한다.
   */
  const effectivePortrait = true;
  const editorOrientation: TableOrientation = "portrait";
  const tableCanvasW = effectivePortrait ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH;
  const tableCanvasH = effectivePortrait ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT;
  const pointerRect = useMemo(
    () =>
      effectivePortrait
        ? getPlayfieldRect(DEFAULT_TABLE_HEIGHT, DEFAULT_TABLE_WIDTH)
        : getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    [effectivePortrait]
  );

  const [playbackPathLinesVisible, setPlaybackPathLinesVisible] = useState(true);
  const [playbackGridVisible, setPlaybackGridVisible] = useState(true);
  const [playbackDrawStyle, setPlaybackDrawStyle] = useState<TableDrawStyle>("realistic");
  const [playbackRate, setPlaybackRate] = useState<0.5 | 1>(1);
  /** 편집기에서 수구/1목 경로선만 각각 숨김(데이터 유지) */
  const [editorCuePathVisible, setEditorCuePathVisible] = useState(true);
  const [editorObjectPathVisible, setEditorObjectPathVisible] = useState(true);
  const [editorSecondObjectPathVisible, setEditorSecondObjectPathVisible] = useState(true);
  const [spotContactToast, setSpotContactToast] = useState<string | null>(null);
  const [spotNavMode, setSpotNavMode] = useState<"move" | "delete">("move");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [thicknessNotSetDialogOpen, setThicknessNotSetDialogOpen] = useState(false);

  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);
  const layoutSrc =
    !ballPlacement && layoutImageUrl ? sanitizeImageSrc(layoutImageUrl) : null;
  const cuePos = layoutForCue
    ? (() => {
        const base =
          layoutForCue.cueBall === "yellow"
            ? layoutForCue.yellowBall
            : layoutForCue.whiteBall;
        if (!panelBallNormOverrides) return base;
        const k = layoutForCue.cueBall === "yellow" ? "yellow" : "white";
        return panelBallNormOverrides[k] ?? base;
      })()
    : { x: 0.5, y: 0.5 };
  /** ?섍뎄 ?쒖쇅 1紐??꾨낫 2援???泥??ㅽ뙚 ?ㅻ깄??醫뚰몴 */
  const firstObjectSnapCandidates = useMemo((): { x: number; y: number }[] | null => {
    if (!layoutForCue) return null;
    return getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y }));
  }, [layoutForCue]);

  /** 광선상 1목 + 수구 폴리라인이 그 충돌점에 닿을 때만 유효 */
  const cueToFirstObjectHit = useMemo(() => {
    if (!layoutForCue) return null;
    return resolveEffectiveFirstObjectCollisionFromCuePath(layoutForCue, cuePos, pathPoints, rect);
  }, [layoutForCue, pathPoints, cuePos, rect]);
  const collisionNorm = cueToFirstObjectHit?.collision ?? null;

  /** 2목 충돌 — 수구 경로 또는 1목 경로 스팟 폴리라인 중 어느 쪽이든 2목 접촉에 닿으면(1목 경로 우선) */
  const objectToSecondObjectHit = useMemo(() => {
    if (!layoutForCue || !collisionNorm) return null;
    const firstObjectKey = cueToFirstObjectHit?.objectKey;
    if (!firstObjectKey) return null;
    return resolveEffectiveSecondObjectCollisionFromPaths(
      layoutForCue,
      cuePos,
      pathPoints,
      collisionNorm,
      objectPathPoints,
      firstObjectKey,
      rect
    );
  }, [layoutForCue, collisionNorm, cuePos, pathPoints, objectPathPoints, cueToFirstObjectHit?.objectKey, rect]);
  const secondObjectCollisionNorm = objectToSecondObjectHit?.collision ?? null;

  useEffect(() => {
    setCuePathActiveSpotId(null);
  }, [pathPoints.length]);

  useEffect(() => {
    setObjectPathActiveSpotId(null);
  }, [objectPathPoints.length]);
  useEffect(() => {
    setSecondObjectPathActiveSpotId(null);
  }, [secondObjectPathPoints.length]);

  const getNormalizedFromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const z = zoomCtxRef.current;
      if (!z) return null;
      const cp = z.viewportClientToCanvasPx(clientX, clientY);
      if (!cp || !isInsidePlayfield(cp.x, cp.y, pointerRect)) return null;
      const vn = pixelToNormalized(cp.x, cp.y, pointerRect);
      return effectivePortrait ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
    },
    [pointerRect, effectivePortrait]
  );

  /** ?뚮젅?댄븘????= norm 쨌 荑좎뀡/?꾨젅??= 罹붾쾭??px (諛섏쭅?좎쑝濡?荑좎뀡?졖룸ぉ?곴뎄 ?섎젅 ?ㅽ뙚) */
  const getPointerAimFromEvent = useCallback(
    (clientX: number, clientY: number): PathPointerAim | null => {
      const z = zoomCtxRef.current;
      if (!z) return null;
      const cp = z.viewportClientToCanvasPx(clientX, clientY);
      if (!cp) return null;
      if (cp.x < -2 || cp.y < -2 || cp.x > tableCanvasW + 2 || cp.y > tableCanvasH + 2) return null;
      if (isInsidePlayfield(cp.x, cp.y, pointerRect)) {
        const vn = pixelToNormalized(cp.x, cp.y, pointerRect);
        const land = effectivePortrait ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
        return { kind: "playfield", norm: land };
      }
      return { kind: "tableCanvas", cx: cp.x, cy: cp.y };
    },
    [pointerRect, effectivePortrait, tableCanvasW, tableCanvasH]
  );

  const rayAppendCtx = useMemo((): CuePathRayAppendContext => {
    return {
      cueLandscape: cuePos,
      canvasW: tableCanvasW,
      canvasH: tableCanvasH,
      portrait: effectivePortrait,
      collisionRectLandscape: rect,
      ballPlacement: layoutForCue,
    };
  }, [cuePos, tableCanvasW, tableCanvasH, effectivePortrait, rect, layoutForCue]);

  const playfieldCenterCanvas = useMemo(() => {
    const r = pointerRect;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [pointerRect]);

  const zoomFocus = isNoteShell ? playfieldCenterCanvas : zoomFocusOverlay;

  useEffect(() => {
    if (isNoteShell) return;
    setZoomFocusOverlay(playfieldCenterCanvas);
  }, [isNoteShell, playfieldCenterCanvas]);

  const cuePathSnapFn: CuePathSnapFn = useCallback(
    (x, y, ctx) => snapCuePathTap(x, y, firstObjectSnapCandidates, { ...ctx, cueNorm: cuePos }),
    [firstObjectSnapCandidates, cuePos]
  );

  const newCueSpotId = useCallback(
    () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const runCueAppend = useCallback(
    (norm: { x: number; y: number }) => {
      const now = Date.now();
      const key = cuePlayfieldAppendDedupeKey(norm);
      const last = lastCuePlayfieldAppendDedupeRef.current;
      if (
        last &&
        now - last.t < CUE_PLAYFIELD_APPEND_DEBOUNCE_MS &&
        last.key === key
      ) {
        return;
      }
      const prevDedupe = lastCuePlayfieldAppendDedupeRef.current;
      lastCuePlayfieldAppendDedupeRef.current = { t: now, key };

      setPathPoints((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
          queueMicrotask(() => {
            setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
            window.setTimeout(() => setSpotContactToast(null), 2800);
          });
          lastCuePlayfieldAppendDedupeRef.current = prevDedupe;
          return prev;
        }
        const r = appendCuePathSpot(prev, norm, cuePathSnapFn, newCueSpotId);
        if (!r.ok) {
          lastCuePlayfieldAppendDedupeRef.current = prevDedupe;
          return prev;
        }
        pushPathUndoSnapshot(prev, objectPathPointsRef.current);
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, pushPathUndoSnapshot]
  );

  const runCueAppendAim = useCallback(
    (aim: PathPointerAim) => {
      if (aim.kind === "playfield") {
        const now = Date.now();
        const key = cuePlayfieldAppendDedupeKey(aim.norm);
        const last = lastCuePlayfieldAppendDedupeRef.current;
        if (
          last &&
          now - last.t < CUE_PLAYFIELD_APPEND_DEBOUNCE_MS &&
          last.key === key
        ) {
          return;
        }
        const prevDedupe = lastCuePlayfieldAppendDedupeRef.current;
        lastCuePlayfieldAppendDedupeRef.current = { t: now, key };
        const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
        setPathPoints((prev) => {
          if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
            queueMicrotask(() => {
              setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
              window.setTimeout(() => setSpotContactToast(null), 2800);
            });
            lastCuePlayfieldAppendDedupeRef.current = prevDedupe;
            return prev;
          }
          const r = appendCuePathSpot(prev, aim.norm, cuePathSnapFn, newCueSpotId);
          if (!r.ok) {
            lastCuePlayfieldAppendDedupeRef.current = prevDedupe;
            return prev;
          }
          const newSlice = r.points.slice(prev.length);
          const isDup = newSlice.some((added) =>
            prev.some(
              (p) =>
                distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
                dupThresholdPx
            )
          );
          if (isDup) {
            lastCuePlayfieldAppendDedupeRef.current = prevDedupe;
            return prev;
          }
          pushPathUndoSnapshot(prev, objectPathPointsRef.current);
          return r.points;
        });
        return;
      }

      const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
      setPathPoints((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
          queueMicrotask(() => {
            setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
            window.setTimeout(() => setSpotContactToast(null), 2800);
          });
          return prev;
        }
        const r = appendCuePathSpotWithAim(prev, aim, cuePathSnapFn, newCueSpotId, rayAppendCtx);
        if (!r.ok) {
          return prev;
        }
        const newSlice = r.points.slice(prev.length);
        const isDup = newSlice.some((added) =>
          prev.some(
            (p) =>
              distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
              dupThresholdPx
          )
        );
        if (isDup) return prev;
        pushPathUndoSnapshot(prev, objectPathPointsRef.current);
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, rayAppendCtx, rect, pushPathUndoSnapshot]
  );

  const addObjectPathPoint = useCallback(
    (norm: { x: number; y: number }, type?: "ball" | "cushion" | "free") => {
      if (type == null) {
        const now = Date.now();
        const key = cuePlayfieldAppendDedupeKey(norm);
        const last = lastObjectPlayfieldAppendDedupeRef.current;
        if (
          last &&
          now - last.t < CUE_PLAYFIELD_APPEND_DEBOUNCE_MS &&
          last.key === key
        ) {
          return;
        }
        lastObjectPlayfieldAppendDedupeRef.current = { t: now, key };
      }
      const newId = () => `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setObjectPathPoints((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
          queueMicrotask(() => {
            setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
            window.setTimeout(() => setSpotContactToast(null), 2800);
          });
          return prev;
        }
        if (type != null) {
          pushPathUndoSnapshot(pathPointsRef.current, prev);
          return [...prev, { id: newId(), x: norm.x, y: norm.y, type }];
        }
        if (!layoutForCue || !collisionNorm) {
          const snapped = snapToPlayfieldCushionJunction(norm.x, norm.y);
          pushPathUndoSnapshot(pathPointsRef.current, prev);
          return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
        }
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;
        const fromForSnap = last ?? collisionNorm;
        /** 吏곸쟾 ?ㅽ뙚??荑좎뀡???꾨땲硫? ?곗옣?좎쓽 荑좎뀡 援먯감 ?????ㅻ깄 ?ㅽ뙚 */
        if (last && last.type !== "cushion") {
          const aimCanvasPx = landscapeNormToPlayfieldCanvasPx(
            norm,
            tableCanvasW,
            tableCanvasH,
            effectivePortrait
          );
          const cushionHit = resolveObjectPathRayHitLandscape({
            fromLandscape: { x: last.x, y: last.y },
            aimCanvasPx,
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionHit && cushionHit.type === "cushion") {
            const maxAutoPx = pathAutoChainNearCushionMaxDistancePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              { x: last.x, y: last.y },
              { x: cushionHit.x, y: cushionHit.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const snapped = snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                { x: cushionHit.x, y: cushionHit.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const id1 = newId();
              const id2 = newId();
              pushPathUndoSnapshot(pathPointsRef.current, prev);
              return [
                ...prev,
                { id: id1, x: cushionHit.x, y: cushionHit.y, type: "cushion" },
                { id: id2, x: snapped.x, y: snapped.y, type: snapped.type },
              ];
            }
          }
        }
        const snapped = snapObjectPathPlayfieldTap(
          norm.x,
          norm.y,
          fromForSnap,
          getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
          rect
        );
        pushPathUndoSnapshot(pathPointsRef.current, prev);
        return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
      });
    },
    [layoutForCue, collisionNorm, rect, tableCanvasW, tableCanvasH, effectivePortrait, pushPathUndoSnapshot]
  );

  const moveObjectPathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setObjectPathPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        if (!isLastSegmentEndpointSpotIndex(prev, idx) && objectPathActiveSpotId !== id) return prev;
        const snapped =
          !layoutForCue || !collisionNorm
            ? snapToPlayfieldCushionJunction(norm.x, norm.y)
            : snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                idx === 0 ? collisionNorm : prev[idx - 1]!,
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
        return prev.map((p) =>
          p.id === id ? { ...p, x: snapped.x, y: snapped.y, type: snapped.type } : p
        );
      });
    },
    [layoutForCue, collisionNorm, rect, objectPathActiveSpotId]
  );

  const removeObjectPathPoint = useCallback(
    (id: string) => {
      setObjectPathPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        if (!isLastSegmentEndpointSpotIndex(prev, idx)) return prev;
        pushPathUndoSnapshot(pathPointsRef.current, prev);
        return prev.filter((p) => p.id !== id);
      });
    },
    [pushPathUndoSnapshot]
  );

  const insertObjectPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      if (!layoutForCue || !collisionNorm) return;
      const chain: { x: number; y: number }[] = [
        collisionNorm,
        ...objectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const fromNorm = chain[segmentIndex];
      if (!fromNorm) return;
      const snapped = snapObjectPathPlayfieldTap(
        norm.x,
        norm.y,
        fromNorm,
        getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
        rect
      );
      const newPoint: NanguPathPoint = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: snapped.x,
        y: snapped.y,
        type: snapped.type,
      };
      setObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        pushPathUndoSnapshot(pathPointsRef.current, prev);
        return next;
      });
    },
    [collisionNorm, layoutForCue, objectPathPoints, rect, pushPathUndoSnapshot]
  );

  const addObjectPathAim = useCallback(
    (aim: PathPointerAim) => {
      if (!layoutForCue || !collisionNorm) return;
      const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
      const newId = () => `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (aim.kind === "playfield") {
        addObjectPathPoint(aim.norm);
        return;
      }
      setObjectPathPoints((prev) => {
        const from =
          prev.length > 0
            ? {
                x: prev[prev.length - 1]!.x,
                y: prev[prev.length - 1]!.y,
              }
            : collisionNorm;
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;

        /** 吏곸쟾??荑좎뀡???꾨땺 ?? 荑좎뀡-only 援먯감 ???대옩?????ㅻ깄 (?섍뎄 寃쎈줈? ?숈씪) */
        if (last && last.type !== "cushion") {
          const cushionOnly = resolveObjectPathRayHitLandscape({
            fromLandscape: from,
            aimCanvasPx: { x: aim.cx, y: aim.cy },
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionOnly && cushionOnly.type === "cushion") {
            const maxAutoPx = pathAutoChainNearCushionMaxDistancePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              from,
              { x: cushionOnly.x, y: cushionOnly.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const tapNorm = tableCanvasClampedToPlayfieldLandscapeNorm(
                aim.cx,
                aim.cy,
                tableCanvasW,
                tableCanvasH,
                effectivePortrait
              );
              const snapped = snapObjectPathPlayfieldTap(
                tapNorm.x,
                tapNorm.y,
                { x: cushionOnly.x, y: cushionOnly.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const newPoints: NanguPathPoint[] = [
                { id: newId(), x: cushionOnly.x, y: cushionOnly.y, type: "cushion" },
                { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type },
              ];
              const isDup = newPoints.some((added) =>
                prev.some(
                  (p) =>
                    distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
                    dupThresholdPx
                )
              );
              if (isDup) return prev;
              pushPathUndoSnapshot(pathPointsRef.current, prev);
              return [...prev, ...newPoints];
            }
          }
        }

        const hit = resolveObjectPathRayHitLandscape({
          fromLandscape: from,
          aimCanvasPx: { x: aim.cx, y: aim.cy },
          canvasW: tableCanvasW,
          canvasH: tableCanvasH,
          portrait: effectivePortrait,
          collisionRectLandscape: rect,
          ballPlacement: layoutForCue,
          allowNonCueBallCircle:
            prev.length === 0 || prev[prev.length - 1]?.type === "cushion",
          excludeBallKeys:
            cueToFirstObjectHit && prev.length === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
        });
        if (!hit) {
          return prev;
        }
        const isDup =
          prev.length > 0 &&
          prev.some(
            (p) =>
              distanceNormPointsInPlayfieldPx({ x: hit.x, y: hit.y }, { x: p.x, y: p.y }, rect) <
              dupThresholdPx
          );
        if (isDup) return prev;
        pushPathUndoSnapshot(pathPointsRef.current, prev);
        return [
          ...prev,
          {
            id: newId(),
            x: hit.x,
            y: hit.y,
            type: hit.type,
          },
        ];
      });
    },
    [
      collisionNorm,
      cueToFirstObjectHit,
      layoutForCue,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      addObjectPathPoint,
      pushPathUndoSnapshot,
    ]
  );

  const insertObjectPathPointBetweenAim = useCallback(
    (segmentIndex: number, aim: PathPointerAim) => {
      if (!layoutForCue || !collisionNorm) return;
      if (aim.kind === "playfield") {
        insertObjectPathPointBetween(segmentIndex, aim.norm);
        return;
      }
      const chain: { x: number; y: number }[] = [
        collisionNorm,
        ...objectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const from = chain[segmentIndex];
      if (!from) return;
      const hit = resolveObjectPathRayHitLandscape({
        fromLandscape: from,
        aimCanvasPx: { x: aim.cx, y: aim.cy },
        canvasW: tableCanvasW,
        canvasH: tableCanvasH,
        portrait: effectivePortrait,
        collisionRectLandscape: rect,
        ballPlacement: layoutForCue,
        allowNonCueBallCircle:
          segmentIndex === 0 || objectPathPoints[segmentIndex - 1]?.type === "cushion",
        excludeBallKeys:
          cueToFirstObjectHit && segmentIndex === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
      });
      if (!hit) {
        return;
      }
      const newPoint: NanguPathPoint = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: hit.x,
        y: hit.y,
        type: hit.type,
      };
      setObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        pushPathUndoSnapshot(pathPointsRef.current, prev);
        return next;
      });
    },
    [
      collisionNorm,
      cueToFirstObjectHit,
      layoutForCue,
      objectPathPoints,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      insertObjectPathPointBetween,
      pushPathUndoSnapshot,
    ]
  );

  const addSecondObjectPathPoint = useCallback(
    (norm: { x: number; y: number }, type?: "ball" | "cushion" | "free") => {
      if (type == null) {
        const now = Date.now();
        const key = cuePlayfieldAppendDedupeKey(norm);
        const last = lastSecondObjectPlayfieldAppendDedupeRef.current;
        if (
          last &&
          now - last.t < CUE_PLAYFIELD_APPEND_DEBOUNCE_MS &&
          last.key === key
        ) {
          return;
        }
        lastSecondObjectPlayfieldAppendDedupeRef.current = { t: now, key };
      }
      const newId = () => `o2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSecondObjectPathPoints((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
          queueMicrotask(() => {
            setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
            window.setTimeout(() => setSpotContactToast(null), 2800);
          });
          return prev;
        }
        if (type != null) {
          pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
          return [...prev, { id: newId(), x: norm.x, y: norm.y, type }];
        }
        if (!layoutForCue || !secondObjectCollisionNorm) {
          const snapped = snapToPlayfieldCushionJunction(norm.x, norm.y);
          pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
          return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
        }
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;
        const fromForSnap = last ?? secondObjectCollisionNorm;
        if (last && last.type !== "cushion") {
          const aimCanvasPx = landscapeNormToPlayfieldCanvasPx(
            norm,
            tableCanvasW,
            tableCanvasH,
            effectivePortrait
          );
          const cushionHit = resolveObjectPathRayHitLandscape({
            fromLandscape: { x: last.x, y: last.y },
            aimCanvasPx,
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionHit && cushionHit.type === "cushion") {
            const maxAutoPx = pathAutoChainNearCushionMaxDistancePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              { x: last.x, y: last.y },
              { x: cushionHit.x, y: cushionHit.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const snapped = snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                { x: cushionHit.x, y: cushionHit.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const id1 = newId();
              const id2 = newId();
              pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
              return [
                ...prev,
                { id: id1, x: cushionHit.x, y: cushionHit.y, type: "cushion" },
                { id: id2, x: snapped.x, y: snapped.y, type: snapped.type },
              ];
            }
          }
        }
        const snapped = snapObjectPathPlayfieldTap(
          norm.x,
          norm.y,
          fromForSnap,
          getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
          rect
        );
        pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
        return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
      });
    },
    [layoutForCue, secondObjectCollisionNorm, rect, tableCanvasW, tableCanvasH, effectivePortrait, pushPathUndoSnapshot]
  );

  const addSecondObjectPathAim = useCallback(
    (aim: PathPointerAim) => {
      if (!layoutForCue || !secondObjectCollisionNorm) return;
      const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
      const newId = () => `o2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (aim.kind === "playfield") {
        addSecondObjectPathPoint(aim.norm);
        return;
      }
      setSecondObjectPathPoints((prev) => {
        if (prev.length >= 2 && prev[prev.length - 1]!.type === "free") {
          queueMicrotask(() => {
            setSpotContactToast("현재 스팟이 공이나 쿠션에 닿아야 다음 스팟을 추가할 수 있습니다.");
            window.setTimeout(() => setSpotContactToast(null), 2800);
          });
          return prev;
        }
        const from =
          prev.length > 0
            ? {
                x: prev[prev.length - 1]!.x,
                y: prev[prev.length - 1]!.y,
              }
            : secondObjectCollisionNorm;
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;

        if (last && last.type !== "cushion") {
          const cushionOnly = resolveObjectPathRayHitLandscape({
            fromLandscape: from,
            aimCanvasPx: { x: aim.cx, y: aim.cy },
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionOnly && cushionOnly.type === "cushion") {
            const maxAutoPx = pathAutoChainNearCushionMaxDistancePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              from,
              { x: cushionOnly.x, y: cushionOnly.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const tapNorm = tableCanvasClampedToPlayfieldLandscapeNorm(
                aim.cx,
                aim.cy,
                tableCanvasW,
                tableCanvasH,
                effectivePortrait
              );
              const snapped = snapObjectPathPlayfieldTap(
                tapNorm.x,
                tapNorm.y,
                { x: cushionOnly.x, y: cushionOnly.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const newPoints: NanguPathPoint[] = [
                { id: newId(), x: cushionOnly.x, y: cushionOnly.y, type: "cushion" },
                { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type },
              ];
              const isDup = newPoints.some((added) =>
                prev.some(
                  (p) =>
                    distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
                    dupThresholdPx
                )
              );
              if (isDup) return prev;
              pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
              return [...prev, ...newPoints];
            }
          }
        }

        const hit = resolveObjectPathRayHitLandscape({
          fromLandscape: from,
          aimCanvasPx: { x: aim.cx, y: aim.cy },
          canvasW: tableCanvasW,
          canvasH: tableCanvasH,
          portrait: effectivePortrait,
          collisionRectLandscape: rect,
          ballPlacement: layoutForCue,
          allowNonCueBallCircle:
            prev.length === 0 || prev[prev.length - 1]?.type === "cushion",
          excludeBallKeys:
            cueToFirstObjectHit && prev.length === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
        });
        if (!hit) {
          return prev;
        }
        const isDup =
          prev.length > 0 &&
          prev.some(
            (p) =>
              distanceNormPointsInPlayfieldPx({ x: hit.x, y: hit.y }, { x: p.x, y: p.y }, rect) <
              dupThresholdPx
          );
        if (isDup) return prev;
        pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
        return [
          ...prev,
          {
            id: newId(),
            x: hit.x,
            y: hit.y,
            type: hit.type,
          },
        ];
      });
    },
    [
      secondObjectCollisionNorm,
      objectToSecondObjectHit,
      layoutForCue,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      addSecondObjectPathPoint,
      pushPathUndoSnapshot,
    ]
  );

  const moveSecondObjectPathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setSecondObjectPathPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        if (!isLastSegmentEndpointSpotIndex(prev, idx) && secondObjectPathActiveSpotId !== id) return prev;
        const snapped =
          !layoutForCue || !secondObjectCollisionNorm
            ? snapToPlayfieldCushionJunction(norm.x, norm.y)
            : snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                idx === 0 ? secondObjectCollisionNorm : prev[idx - 1]!,
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
        return prev.map((p) =>
          p.id === id ? { ...p, x: snapped.x, y: snapped.y, type: snapped.type } : p
        );
      });
    },
    [layoutForCue, secondObjectCollisionNorm, rect, secondObjectPathActiveSpotId]
  );

  const removeSecondObjectPathPoint = useCallback(
    (id: string) => {
      setSecondObjectPathPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        if (!isLastSegmentEndpointSpotIndex(prev, idx)) return prev;
        pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
        return prev.filter((p) => p.id !== id);
      });
    },
    [pushPathUndoSnapshot]
  );

  const insertSecondObjectPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      if (!layoutForCue || !secondObjectCollisionNorm) return;
      const chain: { x: number; y: number }[] = [
        secondObjectCollisionNorm,
        ...secondObjectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const fromNorm = chain[segmentIndex];
      if (!fromNorm) return;
      const snapped = snapObjectPathPlayfieldTap(
        norm.x,
        norm.y,
        fromNorm,
        getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
        rect
      );
      const newPoint: NanguPathPoint = {
        id: `o2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: snapped.x,
        y: snapped.y,
        type: snapped.type,
      };
      setSecondObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
        return next;
      });
    },
    [secondObjectCollisionNorm, layoutForCue, secondObjectPathPoints, rect, pushPathUndoSnapshot]
  );

  const insertSecondObjectPathPointBetweenAim = useCallback(
    (segmentIndex: number, aim: PathPointerAim) => {
      if (!layoutForCue || !secondObjectCollisionNorm) return;
      if (aim.kind === "playfield") {
        insertSecondObjectPathPointBetween(segmentIndex, aim.norm);
        return;
      }
      const chain: { x: number; y: number }[] = [
        secondObjectCollisionNorm,
        ...secondObjectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const from = chain[segmentIndex];
      if (!from) return;
      const hit = resolveObjectPathRayHitLandscape({
        fromLandscape: from,
        aimCanvasPx: { x: aim.cx, y: aim.cy },
        canvasW: tableCanvasW,
        canvasH: tableCanvasH,
        portrait: effectivePortrait,
        collisionRectLandscape: rect,
        ballPlacement: layoutForCue,
        allowNonCueBallCircle:
          segmentIndex === 0 || secondObjectPathPoints[segmentIndex - 1]?.type === "cushion",
        excludeBallKeys:
          cueToFirstObjectHit && segmentIndex === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
      });
      if (!hit) {
        return;
      }
      const newPoint: NanguPathPoint = {
        id: `o2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: hit.x,
        y: hit.y,
        type: hit.type,
      };
      setSecondObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
        return next;
      });
    },
    [
      secondObjectCollisionNorm,
      cueToFirstObjectHit,
      layoutForCue,
      secondObjectPathPoints,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      insertSecondObjectPathPointBetween,
      pushPathUndoSnapshot,
    ]
  );

  const cuePathEditing =
    variant === "trouble" ? troublePathEditLayer === "cue" : pathMode;
  const objectPathEditing =
    variant === "trouble" ? troublePathEditLayer === "object" : objectPathMode;
  const secondObjectPathEditing =
    variant === "trouble" ? troublePathEditLayer === "object2" : secondObjectPathMode;

  const playbackBallSpeed = normalizeBallSpeed(
    settingsValue?.railCount != null ? Number(settingsValue.railCount) : Number(ballSpeed)
  );

  const pathPlayback = useSolutionPathPlayback({
    ballPlacement: layoutForCue,
    pathPoints,
    objectPathPoints,
    ballSpeed: playbackBallSpeed,
    isBankShot,
    thicknessOffsetX,
    ignorePhysics: Boolean(settingsValue?.ignorePhysics),
    cuePathCurveControls,
    cuePathCurveNodes,
    objectPathCurveControls,
    objectPathCurveNodes,
    secondObjectPathPoints,
    secondObjectPathCurveControls: undefined,
    secondObjectPathCurveNodes: undefined,
    /** 1목 경로 그리기 모드 + 스팟 1개 이상일 때만 재생 충돌 팝업 */
    collisionWarningsEnabled: objectPathEditing && objectPathPoints.length >= 1,
    playbackRate,
  });

  const pathPlaybackBusy = pathPlayback.isPlaybackActive || pathPlayback.isPlaybackPaused;

  const activeSpotMoveState = useMemo(() => {
    if (pathPlaybackBusy) return null;
    const layer: "cue" | "object" | "object2" | null = cuePathEditing
      ? "cue"
      : objectPathEditing
        ? "object"
        : secondObjectPathEditing
          ? "object2"
          : null;
    if (!layer) return null;
    const points = layer === "cue" ? pathPoints : layer === "object" ? objectPathPoints : secondObjectPathPoints;
    if (points.length < 2) return null;
    const activeId =
      layer === "cue"
        ? cuePathActiveSpotId
        : layer === "object"
          ? objectPathActiveSpotId
          : secondObjectPathActiveSpotId;
    const currentId = activeId ?? points[points.length - 1]!.id;
    const currentIndexRaw = points.findIndex((p) => p.id === currentId);
    const currentIndex = currentIndexRaw >= 0 ? currentIndexRaw : points.length - 1;
    return {
      layer,
      points,
      currentIndex,
      canPrev: currentIndex > 0,
      canNext: currentIndex < points.length - 1,
    };
  }, [
    cuePathEditing,
    objectPathEditing,
    secondObjectPathEditing,
    pathPlaybackBusy,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints,
    cuePathActiveSpotId,
    objectPathActiveSpotId,
    secondObjectPathActiveSpotId,
  ]);

  const moveActiveSpot = useCallback(
    (delta: -1 | 1) => {
      if (!activeSpotMoveState) return;
      const nextIndex = activeSpotMoveState.currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= activeSpotMoveState.points.length) return;
      const nextId = activeSpotMoveState.points[nextIndex]!.id;
      if (activeSpotMoveState.layer === "cue") {
        setCuePathActiveSpotId(nextId);
    } else if (activeSpotMoveState.layer === "object") {
        setObjectPathActiveSpotId(nextId);
    } else {
      setSecondObjectPathActiveSpotId(nextId);
      }
    },
    [activeSpotMoveState]
  );

  const deleteAdjacentSpot = useCallback(
    (delta: -1 | 1) => {
      if (!activeSpotMoveState) return;
      const targetIndex = activeSpotMoveState.currentIndex + delta;
      if (targetIndex < 0 || targetIndex >= activeSpotMoveState.points.length) return;
      const targetId = activeSpotMoveState.points[targetIndex]!.id;
      if (activeSpotMoveState.layer === "cue") {
        setPathPoints((prev) => {
          const idx = prev.findIndex((p) => p.id === targetId);
          if (idx < 0) return prev;
          pushPathUndoSnapshot(prev, objectPathPointsRef.current);
          return prev.filter((p) => p.id !== targetId);
        });
      } else if (activeSpotMoveState.layer === "object") {
        setObjectPathPoints((prev) => {
          const idx = prev.findIndex((p) => p.id === targetId);
          if (idx < 0) return prev;
          pushPathUndoSnapshot(pathPointsRef.current, prev);
          return prev.filter((p) => p.id !== targetId);
        });
      } else {
        setSecondObjectPathPoints((prev) => {
          const idx = prev.findIndex((p) => p.id === targetId);
          if (idx < 0) return prev;
          pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
          return prev.filter((p) => p.id !== targetId);
        });
      }
    },
    [activeSpotMoveState, pushPathUndoSnapshot]
  );

  useEffect(() => {
    if (!isTroublePlaybackVerboseLogEnabled()) return;
    if (variant !== "trouble" || !settingsValue) return;
    console.debug("[trouble-playback:settings-source]", {
      ballSpeedRaw: playbackBallSpeed,
      thicknessStepRaw: settingsValue.thicknessStep,
      railCountRaw: settingsValue.railCount,
      playbackBallSpeedInput: playbackBallSpeed,
      playbackThicknessOffsetInput: thicknessOffsetX,
      settingsPanelOpen: settingsOpen,
    });
  }, [variant, settingsValue, playbackBallSpeed, thicknessOffsetX, settingsOpen]);

  const mergedBallNormOverridesForCanvas = useMemo(() => {
    const a = panelBallNormOverrides;
    const b = pathPlayback.ballNormOverrides;
    if (!a && !b) return undefined;
    return { ...(a ?? {}), ...(b ?? {}) };
  }, [panelBallNormOverrides, pathPlayback.ballNormOverrides]);

  const overlayCuePathLinesVisible = useMemo(
    () => (!pathPlaybackBusy || playbackPathLinesVisible) && editorCuePathVisible,
    [pathPlaybackBusy, playbackPathLinesVisible, editorCuePathVisible]
  );
  const overlayObjectPathLinesVisible = useMemo(
    () => (!pathPlaybackBusy || playbackPathLinesVisible) && editorObjectPathVisible,
    [pathPlaybackBusy, playbackPathLinesVisible, editorObjectPathVisible]
  );
  const overlaySecondObjectPathLinesVisible = useMemo(
    () => (!pathPlaybackBusy || playbackPathLinesVisible) && editorSecondObjectPathVisible,
    [pathPlaybackBusy, playbackPathLinesVisible, editorSecondObjectPathVisible]
  );

  const cuePosWithPlayback = useMemo(() => {
    if (!layoutForCue) return cuePos;
    const k = layoutForCue.cueBall === "yellow" ? "yellow" : "white";
    if (pathPlayback.isPlaybackActive) {
      const pb = pathPlayback.ballNormOverridesLiveRef.current;
      return pb?.[k] ?? cuePos;
    }
    const pb = pathPlayback.ballNormOverrides;
    if (!pb) return cuePos;
    return pb[k] ?? cuePos;
  }, [
    cuePos,
    layoutForCue,
    pathPlayback.isPlaybackActive,
    pathPlayback.ballNormOverrides,
    pathPlayback.ballNormOverridesLiveRef,
  ]);

  const allowCuePlaybackGestures =
    isNoteShell && Boolean(layoutForCue && pathPoints.length >= 1 && !pathPlayback.isPlaybackActive);

  const wasPlaybackActiveRef = useRef(false);
  useEffect(() => {
    const now = pathPlayback.isPlaybackActive;
    if (now && !wasPlaybackActiveRef.current) {
      /** ?⑥닚蹂닿린?먯꽌???ъ깮 ???숈씪 ?ㅽ????좎? */
      setPlaybackDrawStyle(tableDrawStyle);
    }
    wasPlaybackActiveRef.current = now;
  }, [pathPlayback.isPlaybackActive, tableDrawStyle]);

  useEffect(() => {
    if (!isNoteShell) return;
    ballPlacementFullscreen?.setFullscreen(true);
    return () => {
      ballPlacementFullscreen?.setFullscreen(false);
    };
  }, [isNoteShell, ballPlacementFullscreen]);

  useEffect(() => {
    if (!isNoteShell) return;
    if (variant === "trouble") {
      setTroublePathEditLayer("cue");
    } else {
      setPathMode(true);
      setObjectPathMode(false);
    }
  }, [isNoteShell, variant]);

  const { resetPlayback: resetPathPlayback, pausePlayback: pausePathPlayback } = pathPlayback;
  const handlePlayTap = useCallback(() => {
    if (pathPlayback.isPlaybackActive) {
      pausePathPlayback();
      return;
    }
    if (pathPlayback.isPlaybackPaused) {
      pathPlayback.startPlayback();
      return;
    }
    if (!pathPlayback.canPlayback) return;
    const thicknessUnset = (settingsValue?.thicknessStep ?? 0) >= 16;
    if (!settingsValue?.ignorePhysics && thicknessUnset) {
      setThicknessNotSetDialogOpen(true);
      return;
    }
    pathPlayback.startPlayback();
  }, [pathPlayback, pausePathPlayback, settingsValue?.thicknessStep, settingsValue?.ignorePhysics]);

  const onPathEditCueBallTap = useCallback(() => {
    if (variant === "trouble") setTroublePathEditLayer("cue");
    else {
      setPathMode(true);
      setObjectPathMode(false);
      setSecondObjectPathMode(false);
    }
  }, [variant]);

  const onPathEditObjectBallTap = useCallback(() => {
    if (!collisionNorm) return;
    if (variant === "trouble") {
      setTroublePathEditLayer("object");
      return;
    }
    setObjectPathMode(true);
    setPathMode(false);
  }, [variant, collisionNorm]);

  const objectPathLayerEnabled = Boolean(layoutForCue);
  /** 1목·2목: 스팟 폴리라인이 해당 공에 닿을 때만(geometry `resolveEffective*`) 활성 */
  const objectActiveLayerEnabled = Boolean(layoutForCue && collisionNorm);
  /** 수구·1목 경로 중 폴리라인이 2목 공 접촉에 닿을 때 */
  const secondObjectPathLayerEnabled = Boolean(layoutForCue && secondObjectCollisionNorm);

  const activateCueEditLayer = useCallback(() => {
    if (pathPlaybackBusy) return;
    if (variant === "trouble") setTroublePathEditLayer("cue");
    else {
      setPathMode(true);
      setObjectPathMode(false);
      setSecondObjectPathMode(false);
    }
  }, [variant, pathPlaybackBusy]);

  const activateObjectEditLayer = useCallback(() => {
    if (pathPlaybackBusy) return;
    if (!objectActiveLayerEnabled) return;
    if (variant === "trouble") {
      setTroublePathEditLayer("object");
      return;
    }
    setObjectPathMode(true);
    setPathMode(false);
    setSecondObjectPathMode(false);
  }, [variant, pathPlaybackBusy, objectActiveLayerEnabled]);

  const activateSecondObjectEditLayer = useCallback(() => {
    if (pathPlaybackBusy) return;
    if (!secondObjectPathLayerEnabled) return;
    if (variant === "trouble") setTroublePathEditLayer("object2");
    else {
      setSecondObjectPathMode(true);
      setObjectPathMode(false);
      setPathMode(false);
    }
  }, [variant, pathPlaybackBusy, secondObjectPathLayerEnabled]);

  /**
   * 스팟이 공에 닿지 않으면 1목·2목 레이어 비활성: 접촉 무효 시 수구(또는 가능한 상위 레이어)로 복귀.
   */
  useEffect(() => {
    if (!layoutForCue) return;

    if (variant === "trouble") {
      if (pathPoints.length === 0) {
        if (troublePathEditLayer !== "cue" && troublePathEditLayer !== null) {
          setTroublePathEditLayer("cue");
        }
        return;
      }
      if (objectPathPoints.length === 0 && troublePathEditLayer === "object2") {
        setTroublePathEditLayer(collisionNorm ? "object" : "cue");
        return;
      }
      if (!collisionNorm) {
        if (troublePathEditLayer === "object" || troublePathEditLayer === "object2") {
          setTroublePathEditLayer("cue");
        }
        return;
      }
      if (!secondObjectCollisionNorm && troublePathEditLayer === "object2") {
        setTroublePathEditLayer("object");
      }
      return;
    }

    if (pathPoints.length === 0) {
      if (!pathMode || objectPathMode || secondObjectPathMode) {
        setPathMode(true);
        setObjectPathMode(false);
        setSecondObjectPathMode(false);
      }
      return;
    }
    if (objectPathPoints.length === 0 && secondObjectPathMode) {
      setSecondObjectPathMode(false);
      if (collisionNorm) {
        setObjectPathMode(true);
        setPathMode(false);
      } else {
        setPathMode(true);
        setObjectPathMode(false);
      }
      return;
    }
    if (!collisionNorm) {
      if (objectPathMode || secondObjectPathMode) {
        setPathMode(true);
        setObjectPathMode(false);
        setSecondObjectPathMode(false);
      }
      return;
    }
    if (!secondObjectCollisionNorm && secondObjectPathMode) {
      setSecondObjectPathMode(false);
      setObjectPathMode(true);
      setPathMode(false);
    }
  }, [
    layoutForCue,
    variant,
    collisionNorm,
    secondObjectCollisionNorm,
    troublePathEditLayer,
    pathMode,
    objectPathMode,
    secondObjectPathMode,
    pathPoints.length,
    objectPathPoints.length,
  ]);

  const clearAllPaths = useCallback(() => {
    pushPathUndoSnapshot(pathPointsRef.current, objectPathPointsRef.current);
    resetPathPlayback();
    setPathPoints([]);
    setObjectPathPoints([]);
    setSecondObjectPathPoints([]);
    setCuePathCurveControls([]);
    setObjectPathCurveControls([]);
    setCuePathCurveNodes([]);
    setObjectPathCurveNodes([]);
    if (variant === "trouble") {
      setTroublePathEditLayer("cue");
    } else {
      setSecondObjectPathMode(false);
      setObjectPathMode(false);
      setPathMode(true);
    }
  }, [resetPathPlayback, variant, pushPathUndoSnapshot]);

  const resetPlacementAndPaths = useCallback(() => {
    resetPathPlayback();
    setCueBallChoice(ballPlacement?.cueBall ?? "white");
    setTroubleCurveEditMode(true);
    setPlaybackRate(1);
    clearAllPaths();
  }, [resetPathPlayback, ballPlacement?.cueBall, clearAllPaths]);

  const onUndoPathClick = useCallback(() => {
    if (pathPlaybackBusy) return;
    setPathUndoStack((stack) => {
      if (stack.length === 0) {
        queueMicrotask(() => showUndoLimitToast());
        return stack;
      }
      const snap = stack[stack.length - 1]!;
      const next = stack.slice(0, -1);
      queueMicrotask(() => {
        setPathPoints(clonePathPointsForUndo(snap.cue));
        setObjectPathPoints(clonePathPointsForUndo(snap.obj));
        setSecondObjectPathPoints(clonePathPointsForUndo(snap.obj2 ?? []));
        setCuePathCurveControls(clonePathCurveControls(snap.cueCurves ?? []));
        setObjectPathCurveControls(clonePathCurveControls(snap.objCurves ?? []));
        setCuePathCurveNodes(cloneNanguCurveNodes(snap.cueCurveNodes ?? []));
        setObjectPathCurveNodes(cloneNanguCurveNodes(snap.objCurveNodes ?? []));
        if (stack.length >= MAX_PATH_EDITOR_UNDO && next.length === 0) {
          showUndoLimitToast();
        }
      });
      return next;
    });
  }, [pathPlaybackBusy, showUndoLimitToast]);

  useEffect(() => {
    if (pathPoints.length === 0) {
      setObjectPathPoints([]);
      setSecondObjectPathPoints([]);
      if (variant === "trouble") {
        setTroublePathEditLayer("cue");
      } else {
        setSecondObjectPathMode(false);
        setObjectPathMode(false);
        setPathMode(true);
      }
    }
  }, [pathPoints.length, variant]);

  const movePathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        return moveCuePathSpotById(prev, id, norm, cuePathSnapFn, {
          forceMovableSpotId: cuePathActiveSpotId === id ? id : null,
        });
      });
    },
    [cuePathSnapFn, cuePathActiveSpotId]
  );

  const removePathPoint = useCallback(
    (id: string) => {
      setPathPoints((prev) => {
        if (!prev.some((p) => p.id === id)) return prev;
        pushPathUndoSnapshot(prev, objectPathPointsRef.current);
        return stripInvalidEndSpots(prev.filter((p) => p.id !== id));
      });
    },
    [pushPathUndoSnapshot]
  );

  const removeActiveSpot = useCallback(() => {
    if (!activeSpotMoveState) return;
    const currentId =
      activeSpotMoveState.points[activeSpotMoveState.currentIndex]!.id;
    if (activeSpotMoveState.layer === "cue") {
      removePathPoint(currentId);
    } else if (activeSpotMoveState.layer === "object") {
      removeObjectPathPoint(currentId);
    } else {
      removeSecondObjectPathPoint(currentId);
    }
  }, [
    activeSpotMoveState,
    removePathPoint,
    removeObjectPathPoint,
    removeSecondObjectPathPoint,
  ]);

  const insertPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        const r = insertCuePathSpot(prev, segmentIndex, norm, cuePathSnapFn, newCueSpotId);
        if (!r.ok) {
          return prev;
        }
        pushPathUndoSnapshot(prev, objectPathPointsRef.current);
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, pushPathUndoSnapshot]
  );

  const insertPathPointBetweenAim = useCallback(
    (segmentIndex: number, aim: PathPointerAim) => {
      setPathPoints((prev) => {
        const r = insertCuePathSpotWithAim(prev, segmentIndex, aim, cuePathSnapFn, newCueSpotId, rayAppendCtx);
        if (!r.ok) {
          return prev;
        }
        pushPathUndoSnapshot(prev, objectPathPointsRef.current);
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, rayAppendCtx, pushPathUndoSnapshot]
  );

  useEffect(() => {
    const finePointer =
      typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    const onKey = (e: KeyboardEvent) => {
      if (
        finePointer &&
        e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "z" || e.key === "Z")
      ) {
        const t = e.target;
        if (t instanceof HTMLElement) {
          if (t.closest("input, textarea, select")) return;
          if (t.isContentEditable) return;
        }
        if (pathPlaybackBusy) return;
        e.preventDefault();
        onUndoPathClick();
        return;
      }
      if (e.key !== "Escape") return;
      if (isNoteShell && rightPathDrawerOpen) {
        e.preventDefault();
        setRightPathDrawerOpen(false);
        return;
      }
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onCancel,
    onUndoPathClick,
    pathPlaybackBusy,
    isNoteShell,
    rightPathDrawerOpen,
    variant,
  ]);

  const endTroubleDrawerDrag = useCallback((e: React.PointerEvent) => {
    if (!isNoteShell) return;
    troubleDrawerDragRef.current = null;
    setTroubleDrawerDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const w = troubleDrawerAsideRef.current?.offsetWidth ?? 180;
    const threshold = Math.min(72, w * 0.25);
    setTroubleDrawerDragPx((px) => {
      if (px >= threshold) {
        queueMicrotask(() => setRightPathDrawerOpen(false));
      }
      return 0;
    });
  }, [isNoteShell]);

  const onTroubleDrawerHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell) return;
      e.preventDefault();
      troubleDrawerDragRef.current = {
        startX: e.clientX,
        basePx: troubleDrawerDragPxRef.current,
      };
      setTroubleDrawerDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isNoteShell]
  );

  const onTroubleDrawerHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell || !troubleDrawerDragRef.current) return;
      const w = troubleDrawerAsideRef.current?.offsetWidth ?? 180;
      const { startX, basePx } = troubleDrawerDragRef.current;
      const dx = e.clientX - startX;
      const next = Math.max(0, Math.min(basePx + dx, w));
      setTroubleDrawerDragPx(next);
    },
    [isNoteShell]
  );

  const endTroubleLeftDrawerDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell) return;
      troubleLeftDrawerDragRef.current = null;
      setTroubleLeftDrawerDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const w = troubleLeftDrawerAsideRef.current?.offsetWidth ?? 180;
      const threshold = Math.min(72, w * 0.25);
      setTroubleLeftDrawerDragPx((px) => {
        if (px >= threshold) {
          queueMicrotask(() => setTroubleLeftDrawerOpen(false));
        }
        return 0;
      });
    },
    [isNoteShell]
  );

  const onTroubleLeftDrawerHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell) return;
      e.preventDefault();
      troubleLeftDrawerDragRef.current = {
        startX: e.clientX,
        basePx: troubleLeftDrawerDragPxRef.current,
      };
      setTroubleLeftDrawerDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isNoteShell]
  );

  const onTroubleLeftDrawerHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell || !troubleLeftDrawerDragRef.current) return;
      const w = troubleLeftDrawerAsideRef.current?.offsetWidth ?? 180;
      const { startX, basePx } = troubleLeftDrawerDragRef.current;
      const dx = e.clientX - startX;
      const next = Math.max(0, Math.min(basePx - dx, w));
      setTroubleLeftDrawerDragPx(next);
    },
    [isNoteShell]
  );

  const endLeftPathDrawerDrag = useCallback((e: React.PointerEvent) => {
    if (!isNoteShell) return;
    leftPathDrawerDragRef.current = null;
    setLeftPathDrawerDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const w = leftPathDrawerAsideRef.current?.offsetWidth ?? 180;
    const threshold = Math.min(72, w * 0.25);
    setLeftPathDrawerDragPx((px) => {
      if (px >= threshold) {
        queueMicrotask(() => setLeftPathDrawerOpen(false));
      }
      return 0;
    });
  }, [isNoteShell]);

  const onLeftPathDrawerHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell) return;
      e.preventDefault();
      leftPathDrawerDragRef.current = {
        startX: e.clientX,
        basePx: leftPathDrawerDragPxRef.current,
      };
      setLeftPathDrawerDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isNoteShell]
  );

  const onLeftPathDrawerHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell || !leftPathDrawerDragRef.current) return;
      const w = leftPathDrawerAsideRef.current?.offsetWidth ?? 180;
      const { startX, basePx } = leftPathDrawerDragRef.current;
      const dx = e.clientX - startX;
      const next = Math.max(0, Math.min(basePx - dx, w));
      setLeftPathDrawerDragPx(next);
    },
    [isNoteShell]
  );

  const C = TROUBLE_SOLUTION_CONSOLE;
  const showObjectPath = true;

  const panPointerPolicy = useMemo((): SolutionTablePanPointerPolicy => {
    const ballPickLayout =
      layoutForCue && (cuePathEditing || objectPathEditing) ? layoutForCue : undefined;
    const ballNormOverrides = mergedBallNormOverridesForCanvas ?? undefined;
    const objectPts = showObjectPath ? objectPathPoints : [];
    const secondObjectPts = showObjectPath ? secondObjectPathPoints : [];
    const objMode = objectPathEditing;
    const obj2Mode = secondObjectPathEditing;

    const classifyAt = (clientX: number, clientY: number) => {
      const norm = getNormalizedFromEvent(clientX, clientY);
      if (!norm) return null;
      return classifySolutionPathPointerHit({
        norm,
        pathMode: cuePathEditing,
        objectPathMode: objMode,
        secondObjectPathMode: obj2Mode,
        cuePos: cuePosWithPlayback,
        pathPoints,
        objectPathPoints: objectPts,
        secondObjectPathPoints: secondObjectPts,
        ballPickLayout,
        collisionLayout: layoutForCue ?? null,
        ballNormOverrides,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        allowCuePlaybackGestures,
        pathPlaybackActive: pathPlaybackBusy,
        objectPathCollisionNormOverride: layoutForCue && collisionNorm ? collisionNorm : undefined,
        secondObjectPathCollisionNormOverride:
          layoutForCue && secondObjectCollisionNorm ? secondObjectCollisionNorm : undefined,
        pathEditFirstObjectBallKey: layoutForCue ? (cueToFirstObjectHit?.objectKey ?? null) : undefined,
        objectBallTapSwitchesCueToObjectLayer: variant !== "trouble",
      });
    };

    return {
      isEmptyForPan: (clientX, clientY, target) => {
        if (target instanceof Element) {
          if (target.closest("[data-solution-table-zoom-controls]")) return false;
          if (target.closest("[data-path-fs-drawer-drag]")) return false;
          if (target.closest("[data-path-fine-tune]")) return false;
          if (isNoteShell && target.closest("[data-path-editor-fs-chrome]")) return false;
        }
        const c = classifyAt(clientX, clientY);
        return c != null && isClassificationEmptyForPan(c);
      },
      onEmptyTap: (clientX, clientY, pointerId) => {
        if (suppressZoomEmptyTapPointerIdRef.current === pointerId) {
          suppressZoomEmptyTapPointerIdRef.current = null;
          return;
        }
        const aimMargin = getPointerAimFromEvent(clientX, clientY);
        if (aimMargin?.kind === "tableCanvas") {
          if (cuePathEditing) runCueAppendAim(aimMargin);
          else if (objMode && collisionNorm) addObjectPathAim(aimMargin);
          else if (obj2Mode && collisionNorm) addSecondObjectPathAim(aimMargin);
          return;
        }
        const c = classifyAt(clientX, clientY);
        if (!c) return;
        if (c.kind === "pathObjectBallTap") {
          return;
        }
        if (c.kind === "cueBallContactAppend") {
          const aimMargin = getPointerAimFromEvent(clientX, clientY);
          if (aimMargin?.kind === "tableCanvas" && cuePathEditing) {
            runCueAppendAim(aimMargin);
            return;
          }
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm) return;
          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
          const latestCuePoints = pathPointsRef.current;
          if (
            !cuePathAppendWouldDuplicateExistingSpot(latestCuePoints, norm, rect, dupThresholdPx)
          ) {
            runCueAppend(norm);
          }
          return;
        }
        if (c.kind === "emptyCue") {
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm) return;
          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
          const latestCuePoints = pathPointsRef.current;
          if (
            !cuePathAppendWouldDuplicateExistingSpot(latestCuePoints, norm, rect, dupThresholdPx)
          ) {
            runCueAppend(norm);
          }
        } else if (c.kind === "objectBallMarkingTap") {
          return;
        } else if (c.kind === "emptyObject") {
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm || !collisionNorm) return;
          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
          const latestObjectPoints = objectPathPointsRef.current;
          const isDup =
            latestObjectPoints.length > 0 &&
            latestObjectPoints.some(
              (p) =>
                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) < dupThresholdPx
            );
          if (!isDup) addObjectPathPoint(norm);
        } else if (c.kind === "emptyObject2") {
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm || !collisionNorm) return;
          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
          const latestSecondPoints = secondObjectPathPointsRef.current;
          const isDup =
            latestSecondPoints.length > 0 &&
            latestSecondPoints.some(
              (p) =>
                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) < dupThresholdPx
            );
          if (!isDup) addSecondObjectPathPoint(norm);
        }
      },
    };
  }, [
    variant,
    layoutForCue,
    cuePathEditing,
    objectPathEditing,
    showObjectPath,
    mergedBallNormOverridesForCanvas,
    getNormalizedFromEvent,
    getPointerAimFromEvent,
    cuePosWithPlayback,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints,
    runCueAppend,
    runCueAppendAim,
    addObjectPathPoint,
    addObjectPathAim,
    addSecondObjectPathPoint,
    addSecondObjectPathAim,
    collisionNorm,
    isNoteShell,
    rect,
    allowCuePlaybackGestures,
    pathPlaybackBusy,
    cueToFirstObjectHit?.objectKey,
    secondObjectCollisionNorm,
  ]);

  const rootClass = isNoteShell
    ? "fixed inset-0 z-[10050] flex h-[100dvh] min-h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-site-bg text-site-text"
    : "fixed inset-0 z-[200] flex flex-col bg-site-bg text-site-text";

  const rootStyle: React.CSSProperties | undefined = isNoteShell
    ? {
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }
    : undefined;

  const gridVisibleForTable = pathPlaybackBusy ? playbackGridVisible : tableGridOn;
  const drawStyleForTable = pathPlaybackBusy ? playbackDrawStyle : tableDrawStyle;
  const baseSpotChromeVisible = (isNoteShell ? cueSpotOn : true) && !pathPlaybackBusy;
  /** 점선 깜빡임: 해당 경로 편집 레이어가 켜진 공에만 (비활성 레이어 공에는 표식 없음) */
  const showCueSpot = baseSpotChromeVisible && cuePathEditing;

  const objectPathHighlightBallKey = useMemo((): "red" | "yellow" | "white" | null => {
    if (!layoutForCue || !showObjectPath) return null;
    return cueToFirstObjectHit?.objectKey ?? null;
  }, [layoutForCue, showObjectPath, cueToFirstObjectHit]);

  const showObjectBallSpot =
    baseSpotChromeVisible &&
    objectPathEditing &&
    showObjectPath &&
    objectPathHighlightBallKey != null;

  const secondObjectPathHighlightBallKey = useMemo((): "red" | "yellow" | "white" | null => {
    if (!layoutForCue) return null;
    const cueBall = layoutForCue.cueBall;
    const hitBall = cueToFirstObjectHit?.objectKey;
    if (!hitBall) return null;
    const keys: ("red" | "yellow" | "white")[] = ["red", "yellow", "white"];
    return keys.find((k) => k !== cueBall && k !== hitBall) ?? null;
  }, [layoutForCue, cueToFirstObjectHit]);

  const showSecondObjectBallSpot =
    baseSpotChromeVisible &&
    secondObjectPathEditing &&
    secondObjectPathHighlightBallKey != null;

  const cuePathActiveSpotForRing = useMemo(() => {
    if (pathPoints.length === 0) return null;
    const id = cuePathActiveSpotId ?? pathPoints[pathPoints.length - 1]!.id;
    return pathPoints.find((p) => p.id === id) ?? null;
  }, [pathPoints, cuePathActiveSpotId]);

  const objectPathActiveSpotForRing = useMemo(() => {
    if (objectPathPoints.length === 0) return null;
    const id = objectPathActiveSpotId ?? objectPathPoints[objectPathPoints.length - 1]!.id;
    return objectPathPoints.find((p) => p.id === id) ?? null;
  }, [objectPathPoints, objectPathActiveSpotId]);

  const secondObjectPathActiveSpotForRing = useMemo(() => {
    if (secondObjectPathPoints.length === 0) return null;
    const id =
      secondObjectPathActiveSpotId ?? secondObjectPathPoints[secondObjectPathPoints.length - 1]!.id;
    return secondObjectPathPoints.find((p) => p.id === id) ?? null;
  }, [secondObjectPathPoints, secondObjectPathActiveSpotId]);

  const spotTouchesBallOrCushion = (p: { type: string } | null) =>
    Boolean(p && (p.type === "ball" || p.type === "cushion"));

  const cueBallSpotRingBlackStroke =
    showCueSpot && spotTouchesBallOrCushion(cuePathActiveSpotForRing);
  const objectBallSpotRingBlackStroke =
    showObjectBallSpot && spotTouchesBallOrCushion(objectPathActiveSpotForRing);
  const secondObjectBallSpotRingBlackStroke =
    showSecondObjectBallSpot && spotTouchesBallOrCushion(secondObjectPathActiveSpotForRing);

  /** ?섍뎄 ?쒖쇅 怨듭뿉 寃쎈줈?좎씠 ?ㅽ뙚 諛섏?由꾨낫??媛源앷쾶 遺숈? 寃쎌슦 ???뚯씠釉?以묒븰 ?덈궡 */
  const pathClearanceWarning = useMemo(() => {
    if (!layoutForCue) return false;
    return isPathTooCloseToNonCueBalls({
      rect,
      placement: layoutForCue,
      cuePos,
      pathPoints,
      objectPathPoints,
      collisionNorm,
      collisionStruckBallKey: cueToFirstObjectHit?.objectKey ?? null,
      checkCuePath: cuePathEditing && pathPoints.length >= 1,
      checkObjectPath: objectPathEditing && Boolean(collisionNorm) && objectPathPoints.length >= 1,
      checkSecondObjectPath: secondObjectPathEditing && secondObjectPathPoints.length >= 1,
    });
  }, [
    layoutForCue,
    rect,
    cuePos,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints,
    collisionNorm,
    cueToFirstObjectHit?.objectKey,
    cuePathEditing,
    objectPathEditing,
    secondObjectPathEditing,
  ]);

  const toggleGrid = useCallback(() => {
    if (pathPlaybackBusy) setPlaybackGridVisible((v) => !v);
    else setTableGridOn((v) => !v);
  }, [pathPlaybackBusy]);

  const toggleDrawStyle = useCallback(() => {
    if (pathPlaybackBusy) {
      setPlaybackDrawStyle((d) => (d === "realistic" ? "wireframe" : "realistic"));
    } else {
      setTableDrawStyle((d) => (d === "realistic" ? "wireframe" : "realistic"));
    }
  }, [pathPlaybackBusy]);

  const showMenuInfo = useCallback((message: string) => {
    setMenuInfoFeedback(message);
    window.setTimeout(() => setMenuInfoFeedback(null), 1400);
  }, []);

  const objectPathLinesRequestedVisible =
    showObjectPath &&
    objectPathPoints.length > 0 &&
    (!pathPlaybackBusy || playbackPathLinesVisible) &&
    editorObjectPathVisible;

  const curveLineVisible =
    !pathPlaybackBusy || playbackPathLinesVisible;

  const allowCurveHandleInteraction =
    troubleCurveEditMode &&
    (cuePathEditing || objectPathEditing || secondObjectPathEditing) &&
    !pathPlaybackBusy &&
    curveLineVisible;

  const curveHandlesShowSubtle =
    (cuePathCurveControls.length > 0 ||
      objectPathCurveControls.length > 0 ||
      cuePathCurveNodes.length > 0 ||
      objectPathCurveNodes.length > 0) &&
    curveLineVisible &&
    !allowCurveHandleInteraction &&
    !pathPlaybackBusy;

  const cuePbDbg = pathPlayback.cuePlaybackPathDebug;
  const objPbDbg = pathPlayback.objectPlaybackPathDebug;
  const cueDistDbg = pathPlayback.cuePlaybackDistanceDebug;
  const objDistDbg = pathPlayback.objectPlaybackDistanceDebug;

  const isPathClearanceWarningVisible = useMemo(() => {
    return pathClearanceWarning && layoutForCue && (cuePathEditing || objectPathEditing || secondObjectPathEditing);
  }, [pathClearanceWarning, layoutForCue, cuePathEditing, objectPathEditing, secondObjectPathEditing]);

  return (
    <div
      data-testid="solution-path-editor-fs"
      className={rootClass}
      style={rootStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-fs-title"
      {...(variant === "trouble"
        ? {
            ...(cuePbDbg
              ? {
                  "data-cue-playback-polyline-points": cuePbDbg.polylineVertexCount,
                  "data-cue-playback-curve-node-count": cuePbDbg.cueCurveNodeCount,
                  "data-cue-playback-curve-control-count": cuePbDbg.cueCurveControlCount,
                  "data-cue-playback-has-curve": cuePbDbg.hasCueCurvePlayback ? "1" : "0",
                }
              : {}),
            ...(cueDistDbg
              ? {
                  "data-cue-playable-distance": String(cueDistDbg.playableDistancePx),
                  "data-cue-polyline-length": String(cueDistDbg.polylineLengthPx),
                  "data-cue-effective-travel-length": String(cueDistDbg.effectiveTravelLengthPx),
                  "data-cue-stops-early": cueDistDbg.stopsEarly ? "1" : "0",
                  "data-thickness-loss-ratio":
                    cueDistDbg.thicknessLossRatio != null ? String(cueDistDbg.thicknessLossRatio) : "",
                  "data-cue-playable-distance-before-hit":
                    cueDistDbg.cueDistanceBeforeHitPx != null
                      ? String(cueDistDbg.cueDistanceBeforeHitPx)
                      : "",
                  "data-cue-playable-distance-after-hit":
                    cueDistDbg.cueDistanceAfterHitCapPx != null
                      ? String(cueDistDbg.cueDistanceAfterHitCapPx)
                      : "",
                  "data-thickness-split-applied": cueDistDbg.thicknessSplitApplied ? "1" : "0",
                  "data-curve-coefficient":
                    cueDistDbg.curveDampingMeanCoefficient != null
                      ? String(cueDistDbg.curveDampingMeanCoefficient)
                      : "",
                  "data-curve-segment-count":
                    cueDistDbg.curveSegmentCount != null ? String(cueDistDbg.curveSegmentCount) : "",
                  "data-effective-polyline-length":
                    cueDistDbg.effectivePolylineLengthPx != null
                      ? String(cueDistDbg.effectivePolylineLengthPx)
                      : "",
                  "data-curve-damping-applied": cueDistDbg.curveDampingApplied ? "1" : "0",
                }
              : {}),
            ...(objPbDbg
              ? {
                  "data-object-playback-polyline-points": objPbDbg.polylineVertexCount,
                  "data-object-playback-curve-node-count": objPbDbg.objectCurveNodeCount,
                  "data-object-playback-has-curve": objPbDbg.hasObjectCurvePlayback ? "1" : "0",
                }
              : {}),
            ...(objDistDbg
              ? {
                  "data-object-playable-distance": String(objDistDbg.playableDistancePx),
                  "data-object-polyline-length": String(objDistDbg.polylineLengthPx),
                  "data-object-effective-travel-length": String(objDistDbg.effectiveTravelLengthPx),
                  "data-object-stops-early": objDistDbg.stopsEarly ? "1" : "0",
                  "data-object-playable-distance-from-hit": String(objDistDbg.objectDistanceFromHitPx),
                  "data-object-curve-coefficient":
                    objDistDbg.curveDampingMeanCoefficient != null
                      ? String(objDistDbg.curveDampingMeanCoefficient)
                      : "",
                  "data-object-curve-segment-count":
                    objDistDbg.curveSegmentCount != null ? String(objDistDbg.curveSegmentCount) : "",
                  "data-object-effective-polyline-length":
                    objDistDbg.effectivePolylineLengthPx != null
                      ? String(objDistDbg.effectivePolylineLengthPx)
                      : "",
                  "data-object-curve-damping-applied": objDistDbg.curveDampingApplied ? "1" : "0",
                }
              : {}),
          }
        : {})}
    >
      {variant === "trouble" && (
        <>
          <span
            className="sr-only"
            aria-hidden
            data-testid="trouble-e2e-first-object-key"
            data-state={objectPathHighlightBallKey ?? "none"}
          />
          <span
            className="sr-only"
            aria-hidden
            data-testid="trouble-e2e-blink-flags"
            data-cue-spot-blink={showCueSpot ? "on" : "off"}
            data-object-spot-blink={showObjectBallSpot ? "on" : "off"}
          />
          <span
            className="sr-only"
            aria-hidden
            data-testid="trouble-e2e-playback-debug"
            data-playback-active={pathPlayback.isPlaybackActive ? "1" : "0"}
            data-playback-phase={pathPlayback.playbackPhase}
            data-reflection-path-ready={pathPlayback.playbackReflectionMeta.reflectionPathReady ? "1" : "0"}
            data-reflection-object-ball={pathPlayback.playbackReflectionMeta.reflectionObjectBall ?? "none"}
            data-struck-key-source={pathPlayback.playbackReflectionMeta.struckKeySource}
            data-object-path-points-len={String(pathPlayback.playbackReflectionMeta.objectPathPointsLen)}
            data-moving-ball-key={pathPlayback.playbackReflectionMeta.movingBallKeyResolved ?? "none"}
            data-timing-p-hit-first01={
              pathPlayback.playbackTimingDebug != null
                ? String(pathPlayback.playbackTimingDebug.pHitFirst01)
                : ""
            }
            data-timing-p-warn-recontact-after01={
              pathPlayback.playbackTimingDebug != null
                ? String(pathPlayback.playbackTimingDebug.pWarnRecontactAfter01)
                : ""
            }
            data-timing-hit-progress-source={
              pathPlayback.playbackTimingDebug?.hitProgressSource ?? ""
            }
            data-timing-cue-wall-ms={
              pathPlayback.playbackTimingDebug != null
                ? String(pathPlayback.playbackTimingDebug.cueWallDurationMs)
                : ""
            }
            data-timing-cue-hit-rel-ms={
              pathPlayback.playbackTimingDebug?.cueHitRelMs != null
                ? String(pathPlayback.playbackTimingDebug.cueHitRelMs)
                : ""
            }
            data-timing-object-start-rel-ms={
              pathPlayback.playbackTimingDebug?.objectStartRelMs != null
                ? String(pathPlayback.playbackTimingDebug.objectStartRelMs)
                : ""
            }
            data-timing-cue-complete-rel-ms={
              pathPlayback.playbackTimingDebug?.cueCompleteRelMs != null
                ? String(pathPlayback.playbackTimingDebug.cueCompleteRelMs)
                : ""
            }
            data-timing-warning-rel-ms={
              pathPlayback.playbackTimingDebug?.warningTriggeredRelMs != null
                ? String(pathPlayback.playbackTimingDebug.warningTriggeredRelMs)
                : ""
            }
            data-timing-phase-at-end={pathPlayback.playbackTimingDebug?.playbackPhaseAtEnd ?? ""}
            data-timing-moving-key={pathPlayback.playbackTimingDebug?.movingKey ?? ""}
            data-playback-path-lines-toggle={playbackPathLinesVisible ? "1" : "0"}
            data-path-overlay-above-balls="0"
            data-object-line-visible={
              objectPathLinesRequestedVisible
                ? "1"
                : "0"
            }
          />
        </>
      )}
      <h1 id="path-fs-title" className="sr-only">
        {variant === "trouble" ? "난구해결 경로 편집 전체화면" : "해법 경로 편집 전체화면"}
      </h1>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isNoteShell && (
          <>
            <div
              data-path-editor-fs-chrome=""
              aria-hidden={!rightPathDrawerOpen}
              className={`fixed inset-0 z-[200] bg-black/30 transition-opacity duration-300 ease-out ${
                rightPathDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setRightPathDrawerOpen(false)}
            />
            <aside
              ref={troubleDrawerAsideRef}
              data-path-editor-fs-chrome=""
              id="path-fs-right-drawer-common"
              aria-hidden={!rightPathDrawerOpen}
              className={`fixed right-0 z-[205] flex w-[min(52.8vw,180px)] flex-col border-l border-white/20 bg-black/30 text-white shadow-[-6px_0_20px_rgba(0,0,0,0.25)] backdrop-blur-md ${
                viewportMdUp
                  ? "top-[40%] h-[min(72vh,34rem)] -translate-y-1/2 rounded-l-xl"
                  : "top-0 h-full"
              } ${
                rightPathDrawerOpen ? "pointer-events-auto" : "pointer-events-none translate-x-full"
              } ${troubleDrawerDragging ? "!duration-0" : "transition-transform duration-300 ease-out"}`}
              style={
                rightPathDrawerOpen
                  ? {
                      transform: `${viewportMdUp ? "translateY(-50%) " : ""}translateX(${troubleDrawerDragPx}px)`,
                      transition: troubleDrawerDragging ? "none" : undefined,
                    }
                  : undefined
              }
            >
              {rightPathDrawerOpen && (
                <div
                  data-path-fs-drawer-drag=""
                  aria-hidden
                  className="absolute left-0 top-0 z-10 h-full w-10 cursor-grab touch-none active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                  onPointerDown={onTroubleDrawerHandlePointerDown}
                  onPointerMove={onTroubleDrawerHandlePointerMove}
                  onPointerUp={endTroubleDrawerDrag}
                  onPointerCancel={endTroubleDrawerDrag}
                />
              )}
              <div className="border-b border-white/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h2 className="text-sm font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  설정
                </h2>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">보기</p>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => toggleDrawStyle()}
                >
                  {drawStyleForTable === "realistic" ? "실사보기 → 단순보기" : "단순보기 → 실사보기"}
                </button>
                <button
                  type="button"
                  className={cx(
                    "w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-colors",
                    gridVisibleForTable
                      ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                      : "bg-black/25 text-white/55 hover:bg-black/35"
                  )}
                  onClick={() => toggleGrid()}
                >
                  그리드 표시
                </button>
                <button
                  type="button"
                  className={cx(
                    "w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-colors",
                    cueSpotOn
                      ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                      : "bg-black/25 text-white/55 hover:bg-black/35"
                  )}
                  onClick={() => setCueSpotOn((v) => !v)}
                >
                  수구 표시
                </button>
                <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  애니메이션
                </p>
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-black/20 px-2 py-2">
                  <span className="text-[10px] font-semibold text-white/65">배속</span>
                  <button
                    type="button"
                    className={cx(
                      "rounded px-2 py-1 text-[10px] font-semibold touch-manipulation",
                      playbackRate === 0.5
                        ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                        : "bg-black/30 text-white/55 hover:bg-black/40"
                    )}
                    onClick={() => setPlaybackRate(0.5)}
                  >
                    0.5x
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "rounded px-2 py-1 text-[10px] font-semibold touch-manipulation",
                      playbackRate === 1
                        ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                        : "bg-black/30 text-white/55 hover:bg-black/40"
                    )}
                    onClick={() => setPlaybackRate(1)}
                  >
                    1x
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={cx(
                      "flex-1 rounded-lg px-2 py-2 text-[10px] font-semibold touch-manipulation",
                      playbackPathLinesVisible
                        ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                        : "bg-black/25 text-white/55 hover:bg-black/35"
                    )}
                    onClick={() => setPlaybackPathLinesVisible((v) => !v)}
                  >
                    경로선
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "flex-1 rounded-lg px-2 py-2 text-[10px] font-semibold touch-manipulation",
                      playbackGridVisible
                        ? "bg-site-primary/35 ring-1 ring-site-primary/80 text-white"
                        : "bg-black/25 text-white/55 hover:bg-black/35"
                    )}
                    onClick={() => setPlaybackGridVisible((v) => !v)}
                  >
                    그리드
                  </button>
                </div>
                <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">지원</p>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => showMenuInfo("사용방법은 준비 중입니다.")}
                >
                  사용방법
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => showMenuInfo("기능개선 건의 접수 기능은 준비 중입니다.")}
                >
                  기능개선 건의
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => showMenuInfo("오류신고 접수 기능은 준비 중입니다.")}
                >
                  오류신고
                </button>
                {menuInfoFeedback && (
                  <p className="px-1 text-[11px] font-medium text-white/85">{menuInfoFeedback}</p>
                )}
              </div>
            </aside>
          </>
        )}
        <div
          className={`flex min-h-0 w-full flex-1 flex-col ${
            /* 노트 전체화면: 상단 여백 최소(px·pb만), 당구대는 남는 세로를 아래로 두고 위로 붙임 */
            isNoteShell ? "items-center px-2 pb-2 pt-0" : ""
          }`}
        >
        <div
          className={
            isNoteShell
              ? "relative flex h-full min-h-0 w-[min(100%,42rem)] max-w-2xl min-w-0 flex-1 flex-col pt-0"
              : "relative mx-auto flex w-full max-w-4xl min-h-0 min-w-0 flex-1 flex-col px-2 pt-2"
          }
        >
          {isNoteShell && (
            <>
              <button
                type="button"
                data-path-editor-fs-chrome=""
                data-testid="trouble-e2e-path-close"
                onClick={onCancel}
                className="absolute z-[125] flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/25 bg-black/25 text-white shadow-md backdrop-blur-sm touch-manipulation hover:bg-black/40 active:scale-95"
                style={{
                  top: "max(0.125rem, env(safe-area-inset-top, 0px))",
                  left: "max(0.5rem, env(safe-area-inset-left, 0px))",
                }}
                aria-label="닫기"
              >
                <CloseXIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                data-path-editor-fs-chrome=""
                data-testid="trouble-e2e-undo-last-spot-toolbar"
                data-undo-count={String(pathUndoStack.length)}
                {...(variant === "trouble" ? { "data-trouble-action": C.action.undoLastPathSpot } : {})}
                disabled={pathPlaybackBusy || pathUndoStack.length === 0}
                title={`직전 편집 1회 취소 · 남은 ${pathUndoStack.length}회`}
                onClick={() => onUndoPathClick()}
                className="absolute z-[125] flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/25 bg-black/25 text-white shadow-md backdrop-blur-sm touch-manipulation hover:bg-black/40 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                style={{
                  top: "max(0.125rem, env(safe-area-inset-top, 0px))",
                  right: "max(0.5rem, env(safe-area-inset-right, 0px))",
                }}
                aria-label="되돌리기"
              >
                <UndoStrokeIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                data-path-editor-fs-chrome=""
                aria-label="우측 메뉴 열기"
                aria-expanded={rightPathDrawerOpen}
                aria-controls="path-fs-right-drawer-common"
                onClick={() => setRightPathDrawerOpen(true)}
                className="absolute right-0 top-[40%] z-[125] flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-white/25 bg-black/25 text-white shadow-md backdrop-blur-sm touch-manipulation hover:bg-black/40 active:scale-95 dark:border-white/20 dark:text-white"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 opacity-90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </>
          )}
          <div
            className={
              isNoteShell
                ? "relative mx-auto flex min-h-0 w-full min-w-0 flex-1 cursor-crosshair touch-manipulation items-start justify-center"
                : "relative mx-auto h-full max-h-[min(52vh,480px)] w-full cursor-crosshair touch-manipulation"
            }
            style={isNoteShell ? { minHeight: 0 } : undefined}
          >
            <div
              className={
                isNoteShell
                  ? "relative max-h-full min-h-0 w-full min-w-0 cursor-crosshair touch-manipulation"
                  : "relative h-full w-full min-h-0"
              }
              style={{ aspectRatio: `${tableCanvasW} / ${tableCanvasH}` }}
            >
            <SolutionTableZoomShell
              ref={containerRef}
              contentWidth={tableCanvasW}
              contentHeight={tableCanvasH}
              focusCanvasX={zoomFocus.x}
              focusCanvasY={zoomFocus.y}
              interactionLocked={pathPlaybackBusy}
              panPointerPolicy={panPointerPolicy}
              zoomApiRef={zoomShellApiRef}
              forceShowZoomControls={!isNoteShell}
              fitMode="contain"
              panResetKey={editorOrientation}
              className="relative h-full w-full min-h-0 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
            >
              {(zoom) => {
                zoomCtxRef.current = zoom;
                return (
                  <>
                    <div className="absolute inset-0 w-full h-full">
                      {isPathClearanceWarningVisible && (
                        <div className="pointer-events-none absolute inset-0 z-[130] flex items-center justify-center px-3">
                          <div className="max-w-[min(92%,20rem)] rounded-lg bg-black/60 px-3 py-2.5 text-center text-[11px] font-semibold leading-snug text-white shadow-lg sm:text-xs">
                            경로에 공이 있습니다.
                            <span className="mt-1 block font-normal opacity-95">
                              공이 막히면 공에 스팟을 찍으세요.
                            </span>
                          </div>
                        </div>
                      )}
                      {layoutForCue ? (
                        <NanguReadOnlyLayout
                          ballPlacement={layoutForCue}
                          showGrid={gridVisibleForTable}
                          drawStyle={drawStyleForTable}
                          fillContainer
                          embedFill
                          className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                          hideObjectBall={false}
                          ballNormOverrides={mergedBallNormOverridesForCanvas}
                          ballNormOverridesLiveRef={pathPlayback.ballNormOverridesLiveRef}
                          playbackBallAnimActive={pathPlayback.isPlaybackActive}
                          hideOriginGhostBalls={
                            pathPlaybackBusy && !playbackGridVisible
                          }
                          cueTipNorm={panelCueTipNorm}
                          showCueBallSpot={showCueSpot}
                          showObjectBallSpot={showObjectBallSpot}
                          objectBallSpotKey={objectPathHighlightBallKey}
                          showSecondObjectBallSpot={showSecondObjectBallSpot}
                          secondObjectBallSpotKey={secondObjectPathHighlightBallKey}
                          cueBallSpotRingBlackStroke={cueBallSpotRingBlackStroke}
                          objectBallSpotRingBlackStroke={objectBallSpotRingBlackStroke}
                          secondObjectBallSpotRingBlackStroke={secondObjectBallSpotRingBlackStroke}
                          orientation={editorOrientation}
                          pathOverlayAboveBalls={false}
                          betweenTableAndBallsLayer={
                            <NanguSolutionPathOverlay
                              pathPoints={pathPoints}
                              cuePos={cuePos}
                              tableBallPlacement={layoutForCue}
                              objectPathPoints={showObjectPath ? objectPathPoints : []}
                              secondObjectPathPoints={showObjectPath ? secondObjectPathPoints : []}
                              orientation={editorOrientation}
                              pathMode={cuePathEditing}
                              objectPathMode={objectPathEditing}
                              secondObjectPathMode={secondObjectPathEditing}
                              cueActiveSpotOverrideId={cuePathActiveSpotId}
                              objectActiveSpotOverrideId={objectPathActiveSpotId}
                              secondObjectActiveSpotOverrideId={secondObjectPathActiveSpotId}
                              onCueActiveSpotChange={setCuePathActiveSpotId}
                              onObjectActiveSpotChange={setObjectPathActiveSpotId}
                              onSecondObjectActiveSpotChange={setSecondObjectPathActiveSpotId}
                              getNormalizedFromEvent={getNormalizedFromEvent}
                              getPointerAimFromEvent={getPointerAimFromEvent}
                              onZoomSetFocusCanvasPx={
                                isNoteShell ? undefined : (cx, cy) => setZoomFocusOverlay({ x: cx, y: cy })
                              }
                              ballPickLayout={
                                layoutForCue && (cuePathEditing || objectPathEditing || secondObjectPathEditing)
                                  ? layoutForCue
                                  : undefined
                              }
                              ballNormOverrides={mergedBallNormOverridesForCanvas}
                              onAddPoint={(norm) => {
                                const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                                if (
                                  !cuePathAppendWouldDuplicateExistingSpot(
                                    pathPoints,
                                    norm,
                                    rect,
                                    dupThresholdPx
                                  )
                                ) {
                                  runCueAppend(norm);
                                }
                              }}
                              onAddCuePathAim={runCueAppendAim}
                              onInsertCuePathAim={insertPathPointBetweenAim}
                              onRemovePoint={removePathPoint}
                              onMovePoint={movePathPoint}
                              onPathSpotDragStart={onPathSpotDragStart}
                              onPathSpotDragEnd={onPathSpotDragEnd}
                              onInsertBetween={insertPathPointBetween}
                              onAddObjectPoint={(norm) => {
                                if (!collisionNorm) return;
                                const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                                const isDup =
                                  objectPathPoints.length > 0 &&
                                  objectPathPoints.some(
                                    (p) =>
                                      distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                      dupThresholdPx
                                  );
                                if (!isDup) addObjectPathPoint(norm);
                              }}
                              onAddObjectPathAim={addObjectPathAim}
                              onRemoveObjectPoint={removeObjectPathPoint}
                              onMoveObjectPoint={moveObjectPathPoint}
                              onInsertObjectBetween={insertObjectPathPointBetween}
                              onInsertObjectPathAim={insertObjectPathPointBetweenAim}
                              onAddSecondObjectPoint={(norm) => {
                                if (!secondObjectCollisionNorm) return;
                                const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                                const isDup =
                                  secondObjectPathPoints.length > 0 &&
                                  secondObjectPathPoints.some(
                                    (p) =>
                                      distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                      dupThresholdPx
                                  );
                                if (!isDup) addSecondObjectPathPoint(norm);
                              }}
                              onAddSecondObjectPathAim={addSecondObjectPathAim}
                              onRemoveSecondObjectPoint={removeSecondObjectPathPoint}
                              onMoveSecondObjectPoint={moveSecondObjectPathPoint}
                              onInsertSecondObjectBetween={insertSecondObjectPathPointBetween}
                              onInsertSecondObjectPathAim={insertSecondObjectPathPointBetweenAim}
                              pathLinesVisible={!pathPlaybackBusy || playbackPathLinesVisible}
                              cuePathLinesVisible={overlayCuePathLinesVisible}
                              objectPathLinesVisible={overlayObjectPathLinesVisible}
                              secondObjectPathLinesVisible={overlaySecondObjectPathLinesVisible}
                              allowCuePlaybackGestures={allowCuePlaybackGestures}
                              pathPlaybackActive={pathPlaybackBusy}
                              onCueBallSingleTap={
                                allowCuePlaybackGestures ? () => resetPathPlayback() : undefined
                              }
                              onPathEditCueBallTap={undefined}
                              onPathEditObjectBallTap={undefined}
                              pathEditFirstObjectBallKey={
                                layoutForCue ? (cueToFirstObjectHit?.objectKey ?? null) : undefined
                              }
                              objectBallTapSwitchesCueToObjectLayer={variant !== "trouble"}
                              cueDisplayCurveControls={cuePathCurveControls}
                              objectDisplayCurveControls={objectPathCurveControls}
                              cuePathCurveNodes={cuePathCurveNodes}
                              objectPathCurveNodes={objectPathCurveNodes}
                              troubleCurveEditMode={troubleCurveEditMode}
                              curveHandleInteraction={allowCurveHandleInteraction}
                              curveHandlesShowSubtle={curveHandlesShowSubtle}
                              onUpsertCueDisplayCurve={upsertCueDisplayCurve}
                              onUpsertObjectDisplayCurve={upsertObjectDisplayCurve}
                              onMoveCueDisplayCurve={moveCueDisplayCurve}
                              onMoveObjectDisplayCurve={moveObjectDisplayCurve}
                              onRemoveCueDisplayCurve={removeCueDisplayCurve}
                              onRemoveObjectDisplayCurve={removeObjectDisplayCurve}
                              onCurveHandleDragBegin={onCurveHandleDragBegin}
                              magnifierDrawStyle={drawStyleForTable}
                              magnifierEnabled={false}
                              onPathAppendPointerDown={onPathAppendPointerDown}
                            />
                          }
                        />
                      ) : layoutSrc ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
                          <img
                            src={layoutSrc}
                            alt="원본 공배치"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                          諛곗튂 ?놁쓬
                        </div>
                      )}
                    </div>
                    {!layoutForCue && (
                      <NanguSolutionPathOverlay
                        pathPoints={pathPoints}
                        cuePos={cuePos}
                        objectPathPoints={showObjectPath ? objectPathPoints : []}
                        secondObjectPathPoints={showObjectPath ? secondObjectPathPoints : []}
                        orientation={editorOrientation}
                        pathMode={cuePathEditing}
                        objectPathMode={objectPathEditing}
                        secondObjectPathMode={secondObjectPathEditing}
                        cueActiveSpotOverrideId={cuePathActiveSpotId}
                        objectActiveSpotOverrideId={objectPathActiveSpotId}
                        secondObjectActiveSpotOverrideId={secondObjectPathActiveSpotId}
                        onCueActiveSpotChange={setCuePathActiveSpotId}
                        onObjectActiveSpotChange={setObjectPathActiveSpotId}
                        onSecondObjectActiveSpotChange={setSecondObjectPathActiveSpotId}
                        getNormalizedFromEvent={getNormalizedFromEvent}
                        getPointerAimFromEvent={getPointerAimFromEvent}
                        onZoomSetFocusCanvasPx={
                          isNoteShell ? undefined : (cx, cy) => setZoomFocusOverlay({ x: cx, y: cy })
                        }
                        ballNormOverrides={mergedBallNormOverridesForCanvas}
                        onAddPoint={(norm) => {
                          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                          if (
                            !cuePathAppendWouldDuplicateExistingSpot(
                              pathPoints,
                              norm,
                              rect,
                              dupThresholdPx
                            )
                          ) {
                            runCueAppend(norm);
                          }
                        }}
                        onAddCuePathAim={runCueAppendAim}
                        onInsertCuePathAim={insertPathPointBetweenAim}
                        onRemovePoint={removePathPoint}
                        onMovePoint={movePathPoint}
                        onPathSpotDragStart={onPathSpotDragStart}
                        onPathSpotDragEnd={onPathSpotDragEnd}
                        onInsertBetween={insertPathPointBetween}
                        onAddObjectPoint={(norm) => {
                          if (!collisionNorm) return;
                          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                          const isDup =
                            objectPathPoints.length > 0 &&
                            objectPathPoints.some(
                              (p) =>
                                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                dupThresholdPx
                            );
                          if (!isDup) addObjectPathPoint(norm);
                        }}
                        onAddObjectPathAim={addObjectPathAim}
                        onRemoveObjectPoint={removeObjectPathPoint}
                        onMoveObjectPoint={moveObjectPathPoint}
                        onInsertObjectBetween={insertObjectPathPointBetween}
                        onInsertObjectPathAim={insertObjectPathPointBetweenAim}
                        onAddSecondObjectPoint={(norm) => {
                          if (!secondObjectCollisionNorm) return;
                          const dupThresholdPx = SPOT_APPEND_DUP_THRESHOLD_PX;
                          const isDup =
                            secondObjectPathPoints.length > 0 &&
                            secondObjectPathPoints.some(
                              (p) =>
                                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                dupThresholdPx
                            );
                          if (!isDup) addSecondObjectPathPoint(norm);
                        }}
                        onAddSecondObjectPathAim={addSecondObjectPathAim}
                        onRemoveSecondObjectPoint={removeSecondObjectPathPoint}
                        onMoveSecondObjectPoint={moveSecondObjectPathPoint}
                        onInsertSecondObjectBetween={insertSecondObjectPathPointBetween}
                        onInsertSecondObjectPathAim={insertSecondObjectPathPointBetweenAim}
                        pathLinesVisible={!pathPlaybackBusy || playbackPathLinesVisible}
                        cuePathLinesVisible={overlayCuePathLinesVisible}
                        objectPathLinesVisible={overlayObjectPathLinesVisible}
                        secondObjectPathLinesVisible={overlaySecondObjectPathLinesVisible}
                        allowCuePlaybackGestures={allowCuePlaybackGestures}
                        pathPlaybackActive={pathPlaybackBusy}
                        onCueBallSingleTap={
                          allowCuePlaybackGestures ? () => resetPathPlayback() : undefined
                        }
                        onPathEditCueBallTap={undefined}
                        onPathEditObjectBallTap={undefined}
                        pathEditFirstObjectBallKey={
                          layoutForCue ? (cueToFirstObjectHit?.objectKey ?? null) : undefined
                        }
                        objectBallTapSwitchesCueToObjectLayer={variant !== "trouble"}
                        cueDisplayCurveControls={cuePathCurveControls}
                        objectDisplayCurveControls={objectPathCurveControls}
                        cuePathCurveNodes={cuePathCurveNodes}
                        objectPathCurveNodes={objectPathCurveNodes}
                        troubleCurveEditMode={troubleCurveEditMode}
                        curveHandleInteraction={allowCurveHandleInteraction}
                        curveHandlesShowSubtle={curveHandlesShowSubtle}
                        onUpsertCueDisplayCurve={upsertCueDisplayCurve}
                        onUpsertObjectDisplayCurve={upsertObjectDisplayCurve}
                        onMoveCueDisplayCurve={moveCueDisplayCurve}
                        onMoveObjectDisplayCurve={moveObjectDisplayCurve}
                        onRemoveCueDisplayCurve={removeCueDisplayCurve}
                        onRemoveObjectDisplayCurve={removeObjectDisplayCurve}
                        onCurveHandleDragBegin={onCurveHandleDragBegin}
                        magnifierDrawStyle={drawStyleForTable}
                        magnifierEnabled={false}
                        onPathAppendPointerDown={onPathAppendPointerDown}
                      />
                    )}
                    {!isNoteShell && (
                      <PathPlaybackViewOverlay
                        variant={variant === "trouble" ? "trouble" : "nangu"}
                        active={pathPlaybackBusy}
                        pathLinesVisible={playbackPathLinesVisible}
                        onPathLinesVisibleChange={setPlaybackPathLinesVisible}
                        gridVisible={playbackGridVisible}
                        onGridVisibleChange={setPlaybackGridVisible}
                        drawStyle={playbackDrawStyle}
                        onDrawStyleChange={setPlaybackDrawStyle}
                      />
                    )}
                  </>
                );
              }}
            </SolutionTableZoomShell>
            </div>
          </div>
          {isNoteShell && onSettingsChange && (
            <div className="relative z-[220] mt-0.5 w-full max-w-[min(100%,42rem)] shrink-0 self-center px-1 pb-1">
              <div className="flex w-full flex-col gap-0.5 border-t border-white/10 bg-black/90 px-1 pt-1 shadow-[0_-6px_24px_rgba(0,0,0,0.45)]">
              {(() => {
                const summaryThickness = thicknessDisplayOverlapStep16(settingsValue?.thicknessStep ?? 16);
                const summaryRail = Math.max(1, Math.min(5, Math.round(settingsValue?.railCount ?? 3)));
                const summaryTip = settingsValue?.tipNorm ?? { x: 0, y: 0 };
                const settingsApplyOff = Boolean(settingsValue?.ignorePhysics);
                const btnBase =
                  "rounded-md bg-black py-1 font-semibold touch-manipulation transition-colors border border-zinc-500 [@media(max-height:520px)]:py-0.5";
                const dockCellMinH =
                  "min-h-11 [@media(max-height:680px)]:min-h-10 [@media(max-height:580px)]:min-h-9 [@media(max-height:480px)]:min-h-8 [@media(max-height:400px)]:min-h-7";
                const dockRowGrowBtn = cx(
                  btnBase,
                  dockCellMinH,
                  "flex min-w-0 grow items-center justify-center px-0.5 text-center text-[9px] leading-tight disabled:pointer-events-none disabled:opacity-40 disabled:grayscale [@media(max-height:480px)]:text-[8px]"
                );

                return (
                  <>
                    <div className="flex w-full min-w-0 items-stretch gap-0.5 pb-0.5">
                      <span className="shrink-0 self-center px-0.5 text-[9px] font-bold leading-tight text-zinc-400 [@media(max-height:480px)]:text-[8px]">
                        보이기
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditorCuePathVisible((v) => !v)}
                        className={cx(
                          dockRowGrowBtn,
                          editorCuePathVisible ? "border-red-500 text-red-400" : "text-zinc-500"
                        )}
                      >
                        수구경로선
                      </button>
                      <button
                        type="button"
                        disabled={!objectPathLayerEnabled}
                        onClick={() => objectPathLayerEnabled && setEditorObjectPathVisible((v) => !v)}
                        className={cx(
                          dockRowGrowBtn,
                          editorObjectPathVisible ? "border-blue-500 text-blue-400" : "text-zinc-500"
                        )}
                      >
                        1목경로선
                      </button>
                      <button
                        type="button"
                        disabled={!secondObjectPathLayerEnabled}
                        onClick={() =>
                          secondObjectPathLayerEnabled && setEditorSecondObjectPathVisible((v) => !v)
                        }
                        className={cx(
                          dockRowGrowBtn,
                          editorSecondObjectPathVisible ? "border-emerald-500 text-emerald-400" : "text-zinc-500"
                        )}
                      >
                        2목경로선
                      </button>
                      <span className="shrink-0 self-center px-0.5 text-[9px] font-bold leading-tight text-zinc-400 [@media(max-height:480px)]:text-[8px]">
                        활성
                      </span>
                      <button
                        type="button"
                        disabled={pathPlaybackBusy}
                        onClick={activateCueEditLayer}
                        className={cx(
                          dockRowGrowBtn,
                          cuePathEditing ? "border-red-500 text-red-400" : "text-zinc-500"
                        )}
                      >
                        수구
                      </button>
                      <button
                        type="button"
                        disabled={pathPlaybackBusy || !objectActiveLayerEnabled}
                        onClick={activateObjectEditLayer}
                        className={cx(
                          dockRowGrowBtn,
                          objectPathEditing ? "border-blue-500 text-blue-400" : "text-zinc-500"
                        )}
                      >
                        1목적구
                      </button>
                      <button
                        type="button"
                        disabled={pathPlaybackBusy || !secondObjectPathLayerEnabled}
                        onClick={activateSecondObjectEditLayer}
                        className={cx(
                          dockRowGrowBtn,
                          secondObjectPathEditing ? "border-emerald-500 text-emerald-400" : "text-zinc-500"
                        )}
                      >
                        2목적구
                      </button>
                    </div>
                    <div className="grid w-full grid-cols-8 gap-0.5 pb-0.5">
                      <button
                        type="button"
                        className={cx(
                          btnBase,
                          dockCellMinH,
                          "flex w-full items-center justify-center text-[9px] text-amber-200 disabled:opacity-40 [@media(max-height:480px)]:text-[8px]"
                        )}
                        disabled={pathPlaybackBusy}
                        onClick={() => {
                          if (!window.confirm("저장된 수구·1목 경로를 모두 지울까요?")) return;
                          clearAllPaths();
                        }}
                      >
                        초기화
                      </button>
                      <button
                        type="button"
                        className={cx(
                          btnBase,
                          dockCellMinH,
                          "col-span-2 flex w-full items-center justify-around px-1 text-yellow-300 [@media(max-height:480px)]:text-[8px]"
                        )}
                        onClick={() => onSettingsOpen?.()}
                      >
                        {settingsApplyOff ? (
                          <span className="px-1 text-center text-[11px] font-bold leading-snug text-yellow-200 [@media(max-height:480px)]:text-[10px]">
                            설정적용안함
                          </span>
                        ) : (
                          <>
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] opacity-70">두께</span>
                              <span className="text-[10px] font-bold [@media(max-height:480px)]:text-[9px]">
                                {summaryThickness}/16
                              </span>
                            </div>
                            <div className="flex flex-col items-center justify-center px-0.5">
                              <div className="relative h-6 w-6 shrink-0 [@media(max-height:480px)]:h-5 [@media(max-height:480px)]:w-5">
                                <div
                                  className="h-full w-full rounded-full bg-white"
                                  style={{
                                    boxShadow:
                                      "inset 0 1px 2px rgba(255,255,255,0.95), inset 0 -1px 2px rgba(0,0,0,0.14)",
                                  }}
                                />
                                <div
                                  className="absolute h-1.5 w-1.5 rounded-full bg-red-500 [@media(max-height:480px)]:h-1 [@media(max-height:480px)]:w-1"
                                  style={{
                                    left: `${50 + summaryTip.x * 50 * CUE_TIP_NORM_DISPLAY_FRAC}%`,
                                    top: `${50 + summaryTip.y * 50 * CUE_TIP_NORM_DISPLAY_FRAC}%`,
                                    transform: "translate(-50%, -50%)",
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] opacity-70">속도</span>
                              <span className="text-[10px] font-bold [@media(max-height:480px)]:text-[9px]">
                                R{summaryRail}
                              </span>
                            </div>
                          </>
                        )}
                      </button>

                      <div
                        className={cx(
                          btnBase,
                          dockCellMinH,
                          "col-span-3 flex w-full items-stretch overflow-hidden p-0"
                        )}
                      >
                        <button
                          type="button"
                          className="flex h-full flex-1 items-center justify-center font-bold text-yellow-300 hover:bg-zinc-800 disabled:opacity-30 [@media(max-height:480px)]:text-sm"
                          disabled={!activeSpotMoveState?.canPrev}
                          onClick={() => moveActiveSpot(-1)}
                          aria-label="이전 스팟"
                        >
                          ◀
                        </button>
                        <div className="flex h-full flex-[2] items-center justify-center border-x border-zinc-500 text-[9px] text-yellow-300 [@media(max-height:480px)]:text-[8px]">
                          스팟이동
                        </div>
                        <button
                          type="button"
                          className="flex h-full flex-1 items-center justify-center font-bold text-yellow-300 hover:bg-zinc-800 disabled:opacity-30 [@media(max-height:480px)]:text-sm"
                          disabled={!activeSpotMoveState?.canNext}
                          onClick={() => moveActiveSpot(1)}
                          aria-label="다음 스팟"
                        >
                          ▶
                        </button>
                      </div>

                      <button
                        type="button"
                        className={cx(
                          btnBase,
                          dockCellMinH,
                          "flex w-full items-center justify-center text-[9px] text-red-400 disabled:opacity-40 [@media(max-height:480px)]:text-[8px]"
                        )}
                        onClick={removeActiveSpot}
                        disabled={!activeSpotMoveState}
                      >
                        스팟삭제
                      </button>

                      <button
                        type="button"
                        className={cx(
                          btnBase,
                          dockCellMinH,
                          "flex w-full items-center justify-center text-[9px] font-semibold",
                          pathPlayback.isPlaybackActive ? "text-yellow-300" : "text-white"
                        )}
                        disabled={
                          !pathPlayback.canPlayback &&
                          !pathPlayback.isPlaybackActive &&
                          !pathPlayback.isPlaybackPaused
                        }
                        onClick={handlePlayTap}
                      >
                        {pathPlayback.isPlaybackActive ? "멈춤" : "재생"}
                      </button>
                    </div>
                  </>
                );
              })()}
              </div>
            </div>
          )}
        </div>
        </div>

        {!isNoteShell && (
        <div
          className="shrink-0 space-y-2 overflow-y-auto border-t border-zinc-200/90 bg-gradient-to-b from-zinc-50/90 to-white px-3 py-3 dark:border-slate-700 dark:from-zinc-900/90 dark:to-slate-900 max-h-[min(28vh,320px)] sm:max-h-[38vh]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          {...(variant === "trouble" ? { "data-trouble-region": C.region.pathToolbar } : {})}
        >
          <>
            <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 self-center px-0.5 text-[11px] font-bold tracking-tight text-zinc-500 dark:text-zinc-400 sm:text-xs">
                보이기
              </span>
              <button
                type="button"
                onClick={() => setEditorCuePathVisible((v) => !v)}
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  editorCuePathVisible
                    ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                수구경로선
              </button>
              <button
                type="button"
                disabled={!objectPathLayerEnabled}
                onClick={() => objectPathLayerEnabled && setEditorObjectPathVisible((v) => !v)}
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  editorObjectPathVisible
                    ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                1목경로선
              </button>
              <button
                type="button"
                disabled={!secondObjectPathLayerEnabled}
                onClick={() =>
                  secondObjectPathLayerEnabled && setEditorSecondObjectPathVisible((v) => !v)
                }
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  editorSecondObjectPathVisible
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                2목경로선
              </button>
              <span className="shrink-0 self-center px-0.5 text-[11px] font-bold tracking-tight text-zinc-500 dark:text-zinc-400 sm:text-xs">
                활성
              </span>
              <button
                type="button"
                disabled={pathPlaybackBusy}
                onClick={activateCueEditLayer}
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  cuePathEditing
                    ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                수구
              </button>
              <button
                type="button"
                disabled={pathPlaybackBusy || !objectActiveLayerEnabled}
                onClick={activateObjectEditLayer}
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  objectPathEditing
                    ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                1목적구
              </button>
              <button
                type="button"
                disabled={pathPlaybackBusy || !secondObjectPathLayerEnabled}
                onClick={activateSecondObjectEditLayer}
                className={cx(
                  pathBarMiniBtn,
                  "min-w-0 grow text-center",
                  secondObjectPathEditing
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                )}
              >
                2목적구
              </button>
              <span
                className="mx-0.5 h-9 w-px shrink-0 self-center bg-zinc-300 dark:bg-zinc-600"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => onSettingsOpen?.()}
                className={cx(pathBarMiniBtn, "shrink-0", toolbarGhost)}
              >
                설정
              </button>
              <button
                type="button"
                data-undo-count={String(pathUndoStack.length)}
                {...(variant === "trouble" ? { "data-trouble-action": C.action.undoLastPathSpot } : {})}
                disabled={pathPlaybackBusy}
                title={`직전 편집 1회 취소 · 남은 ${pathUndoStack.length}회`}
                onClick={() => onUndoPathClick()}
                className={cx(pathBarMiniBtn, "shrink-0", toolbarGhost)}
              >
                되돌리기·{pathUndoStack.length}
              </button>
              <button
                type="button"
                {...(variant === "trouble" ? { "data-trouble-action": C.action.clearAllPaths } : {})}
                disabled={
                  (pathPoints.length === 0 &&
                    objectPathPoints.length === 0 &&
                    secondObjectPathPoints.length === 0) ||
                  pathPlaybackBusy
                }
                onClick={() => clearAllPaths()}
                className={cx(pathBarMiniBtn, "shrink-0", toolbarDanger)}
              >
                전체삭제
              </button>
              <button
                type="button"
                {...(variant === "trouble" ? { "data-trouble-action": C.action.playPath } : {})}
                disabled={!pathPlayback.canPlayback || pathPlayback.isPlaybackActive}
                onClick={handlePlayTap}
                className={cx(pathBarMiniBtn, "shrink-0", toolbarAccent, "px-2.5 font-semibold")}
              >
                {pathPlayback.isPlaybackActive
                  ? "재생중"
                  : pathPlayback.isPlaybackPaused
                    ? "재생"
                    : "시연"}
              </button>
            </div>
          </>
        </div>
        )}
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => onSettingsClose?.()}
        value={settingsValue}
        onChange={onSettingsChange}
        showMobileThumbnail={false}
        focusSectionOnOpen={settingsFocusSection}
      />

      {cuePickerOpen && layoutForCue && !readOnlyCueAndBalls && (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-transparent"
          aria-modal="true"
          role="dialog"
          aria-label="수구 선택"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            aria-label="닫기"
            onClick={() => setCuePickerOpen(false)}
          />
          <div className="relative z-[1] mx-4 flex flex-col items-center rounded-xl bg-transparent px-6 py-5">
            <p
              className="text-center text-base font-medium text-white mb-6"
              style={{
                textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.6)",
              }}
            >
              ?섍뎄瑜??좏깮?섏꽭??            </p>
            <div className="flex gap-8 justify-center">
              <button
                type="button"
                onClick={() => {
                  setCueBallChoice("white");
                  setCuePickerOpen(false);
                }}
                className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                  cueBallChoice === "white"
                    ? "border-site-primary ring-2 ring-site-primary/50"
                    : "border-white/20"
                }`}
                aria-label="흰공을 수구로"
              >
                <span
                  className="h-[60px] w-[60px] rounded-full bg-[#f8f8f8] shadow-inner block"
                  style={{
                    boxShadow:
                      "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCueBallChoice("yellow");
                  setCuePickerOpen(false);
                }}
                className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                  cueBallChoice === "yellow"
                    ? "border-site-primary ring-2 ring-site-primary/50"
                    : "border-white/20"
                }`}
                aria-label="노란공을 수구로"
              >
                <span
                  className="h-[60px] w-[60px] rounded-full bg-[#f5d033] block"
                  style={{
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[10055] flex items-center justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="초기화 확인 닫기"
            onClick={() => setResetConfirmOpen(false)}
          />
          <div className="relative z-[1] w-[min(92vw,22rem)] rounded-xl border border-white/20 bg-black/80 p-4 text-white shadow-xl">
            <p className="text-sm font-semibold">배치를 초기화할까요?</p>
            <p className="mt-2 text-xs text-white/80">현재 편집한 경로와 곡선 설정이 삭제됩니다.</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                onClick={() => setResetConfirmOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                onClick={() => {
                  setResetConfirmOpen(false);
                  resetPlacementAndPaths();
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {thicknessNotSetDialogOpen && (
        <div className="fixed inset-0 z-[10056] flex items-center justify-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="두께 안내 닫기"
            onClick={() => setThicknessNotSetDialogOpen(false)}
          />
          <div className="relative z-[1] w-[min(92vw,22rem)] rounded-xl border border-white/20 bg-black/80 p-4 text-white shadow-xl">
            <p className="text-sm font-semibold">두께가 설정되지 않았습니다.</p>
            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                onClick={() => {
                  setThicknessNotSetDialogOpen(false);
                  onSettingsOpen?.("thickness");
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {undoLimitToastVisible && (
        <div
          className="pointer-events-none fixed inset-0 z-[10060] flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <p className="rounded-xl bg-black/80 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg ring-1 ring-white/10">
            ???댁긽 ?섎룎由????놁뒿?덈떎
          </p>
        </div>
      )}

      {spotContactToast && (
        <div
          className="pointer-events-none fixed inset-0 z-[10058] flex items-center justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <p className="max-w-[min(92vw,22rem)] rounded-xl bg-black/85 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg ring-1 ring-white/15">
            {spotContactToast}
          </p>
        </div>
      )}

      <CollisionWarningToast
        variant="plain"
        message={pathPlayback.collisionMessage}
        onDismiss={pathPlayback.dismissCollisionMessage}
      />
    </div>
  );
}

