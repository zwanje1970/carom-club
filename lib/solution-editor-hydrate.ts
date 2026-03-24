/**
 * 저장된 NanguSolutionData → 해법 에디터 초기 state (물리·경로 수식 변경 없음)
 */
import type { BallSpeed } from "@/lib/ball-speed-constants";
import { initialBallSpeedFromSolution, normalizeBallSpeed } from "@/lib/ball-speed-constants";
import { thicknessOffsetXFromThicknessStep } from "@/lib/solution-panel-ball-layout";
import {
  DEFAULT_SOLUTION_SETTINGS,
  clampSolutionSettings,
  mergeSolutionSettings,
  type SolutionSettingsValue,
} from "@/lib/solution-settings-panel-value";
import type { NanguCurveNode, NanguPathPoint, NanguSolutionData } from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { cloneNanguCurveNodes } from "@/lib/nangu-curve-nodes";
import {
  createInitialNanguSolutionEditorSnapshot,
  type NanguSolutionEditorUndoSnapshot,
} from "@/lib/nangu-solution-editor-undo";

function pathPointsFromFirstPath(
  path: NanguSolutionData["paths"][number] | undefined
): NanguPathPoint[] {
  if (!path) return [];
  if (path.pointsWithType && path.pointsWithType.length > 0) {
    return path.pointsWithType.map((p) => ({ ...p }));
  }
  if (!path.points?.length) return [];
  return path.points.map((p, i) => ({
    id: `restored-${i}`,
    x: p.x,
    y: p.y,
    type: (i === 0 ? "ball" : "free") as NanguPathPoint["type"],
  }));
}

function objectPathPointsFromReflection(
  ref: NanguSolutionData["reflectionPath"]
): NanguPathPoint[] {
  if (!ref) return [];
  if (ref.pointsWithType && ref.pointsWithType.length > 0) {
    return ref.pointsWithType.map((p) => ({ ...p }));
  }
  if (!ref.points?.length) return [];
  return ref.points.map((p, i) => ({
    id: `obj-restored-${i}`,
    x: p.x,
    y: p.y,
    type: (i === 0 ? "ball" : "free") as NanguPathPoint["type"],
  }));
}

export function hydrateNanguEditorSnapshotFromPartialSolution(
  data: Partial<NanguSolutionData> | null | undefined
): NanguSolutionEditorUndoSnapshot {
  const base = createInitialNanguSolutionEditorSnapshot();
  if (!data) return base;

  const settings = data.settings
    ? clampSolutionSettings(mergeSolutionSettings(data.settings, DEFAULT_SOLUTION_SETTINGS))
    : null;

  const isBankShot = data.isBankShot ?? base.isBankShot;

  let thicknessOffsetX = data.thicknessOffsetX ?? base.thicknessOffsetX;
  if (settings && !isBankShot) {
    thicknessOffsetX = thicknessOffsetXFromThicknessStep(settings.thicknessStep, settings.cueSide);
  }

  const ballSpeed: BallSpeed = settings
    ? normalizeBallSpeed(settings.ballSpeed)
    : initialBallSpeedFromSolution(data);

  const backstrokeLevel = settings
    ? settings.backstroke
    : data.backstrokeLevel ?? base.backstrokeLevel;
  const followStrokeLevel = settings
    ? settings.followStroke
    : data.followStrokeLevel ?? base.followStrokeLevel;

  const spinX = data.spinX ?? data.tipX ?? base.spinX;
  const spinY = data.spinY ?? data.tipY ?? base.spinY;

  const path0 = data.paths?.[0];
  const pathPoints = pathPointsFromFirstPath(path0);

  return {
    ...base,
    isBankShot,
    thicknessOffsetX,
    spinX,
    spinY,
    backstrokeLevel,
    followStrokeLevel,
    ballSpeed,
    pathPoints,
    cuePathCurveNodes: data.cuePathCurveNodes?.length
      ? cloneNanguCurveNodes(data.cuePathCurveNodes)
      : base.cuePathCurveNodes,
    objectPathCurveNodes: data.objectPathCurveNodes?.length
      ? cloneNanguCurveNodes(data.objectPathCurveNodes)
      : base.objectPathCurveNodes,
    explanationText: data.explanationText ?? base.explanationText,
  };
}

export function createInitialNanguSnapshotFromEditorProps(
  initialSolutionData?: Partial<NanguSolutionData> | null,
  initialPersistedSettings?: SolutionSettingsValue | null
): NanguSolutionEditorUndoSnapshot {
  const merged =
    initialSolutionData ??
    (initialPersistedSettings ? { settings: initialPersistedSettings } : null);
  if (!merged) return createInitialNanguSolutionEditorSnapshot();
  return hydrateNanguEditorSnapshotFromPartialSolution(merged);
}

export function resolvePanelSettingsAndAuthority(
  initialSolutionData?: Partial<NanguSolutionData> | null,
  initialPersistedSettings?: SolutionSettingsValue | null
): { settings: SolutionSettingsValue; authoritative: boolean } {
  const raw = initialSolutionData?.settings ?? initialPersistedSettings;
  if (!raw) {
    return { settings: { ...DEFAULT_SOLUTION_SETTINGS }, authoritative: false };
  }
  return {
    settings: clampSolutionSettings(mergeSolutionSettings(raw, DEFAULT_SOLUTION_SETTINGS)),
    authoritative: true,
  };
}

export type TroubleSolutionEditorHydratedState = {
  isBankShot: boolean;
  thicknessOffsetX: number;
  spinX: number;
  spinY: number;
  backstrokeLevel: number;
  followStrokeLevel: number;
  ballSpeed: BallSpeed;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  cuePathDisplayCurves: PathSegmentCurveControl[];
  objectPathDisplayCurves: PathSegmentCurveControl[];
  cuePathCurveNodes: NanguCurveNode[];
  objectPathCurveNodes: NanguCurveNode[];
  explanationText: string;
};

const TROUBLE_HYDRATE_DEFAULT: TroubleSolutionEditorHydratedState = {
  isBankShot: false,
  thicknessOffsetX: 0.5,
  spinX: 0,
  spinY: 0,
  backstrokeLevel: 0,
  followStrokeLevel: 5,
  ballSpeed: 3.0,
  pathPoints: [],
  objectPathPoints: [],
  cuePathDisplayCurves: [],
  objectPathDisplayCurves: [],
  cuePathCurveNodes: [],
  objectPathCurveNodes: [],
  explanationText: "",
};

export function hydrateTroubleSolutionEditorFromPartial(
  data: Partial<NanguSolutionData> | null | undefined,
  options?: { initialContent?: string | null }
): TroubleSolutionEditorHydratedState {
  if (!data) {
    return {
      ...TROUBLE_HYDRATE_DEFAULT,
      explanationText:
        options?.initialContent !== undefined && options?.initialContent !== null
          ? options.initialContent
          : TROUBLE_HYDRATE_DEFAULT.explanationText,
    };
  }

  const settings = data.settings
    ? clampSolutionSettings(mergeSolutionSettings(data.settings, DEFAULT_SOLUTION_SETTINGS))
    : null;

  const isBankShot = data.isBankShot ?? TROUBLE_HYDRATE_DEFAULT.isBankShot;

  let thicknessOffsetX = data.thicknessOffsetX ?? TROUBLE_HYDRATE_DEFAULT.thicknessOffsetX;
  if (settings && !isBankShot) {
    thicknessOffsetX = thicknessOffsetXFromThicknessStep(settings.thicknessStep, settings.cueSide);
  }

  const ballSpeed: BallSpeed = settings
    ? normalizeBallSpeed(settings.ballSpeed)
    : initialBallSpeedFromSolution(data);

  const backstrokeLevel = settings
    ? settings.backstroke
    : data.backstrokeLevel ?? TROUBLE_HYDRATE_DEFAULT.backstrokeLevel;
  const followStrokeLevel = settings
    ? settings.followStroke
    : data.followStrokeLevel ?? TROUBLE_HYDRATE_DEFAULT.followStrokeLevel;

  const spinX = data.spinX ?? data.tipX ?? TROUBLE_HYDRATE_DEFAULT.spinX;
  const spinY = data.spinY ?? data.tipY ?? TROUBLE_HYDRATE_DEFAULT.spinY;

  const path0 = data.paths?.[0];
  const pathPoints = pathPointsFromFirstPath(path0);
  const objectPathPoints = objectPathPointsFromReflection(data.reflectionPath);

  const explanationText =
    options?.initialContent !== undefined && options?.initialContent !== null
      ? options.initialContent
      : data.explanationText ?? TROUBLE_HYDRATE_DEFAULT.explanationText;

  return {
    isBankShot,
    thicknessOffsetX,
    spinX,
    spinY,
    backstrokeLevel,
    followStrokeLevel,
    ballSpeed,
    pathPoints,
    objectPathPoints,
    cuePathDisplayCurves: Array.isArray(data.cuePathDisplayCurves)
      ? (data.cuePathDisplayCurves as PathSegmentCurveControl[])
      : TROUBLE_HYDRATE_DEFAULT.cuePathDisplayCurves,
    objectPathDisplayCurves: Array.isArray(data.objectPathDisplayCurves)
      ? (data.objectPathDisplayCurves as PathSegmentCurveControl[])
      : TROUBLE_HYDRATE_DEFAULT.objectPathDisplayCurves,
    cuePathCurveNodes: data.cuePathCurveNodes?.length
      ? cloneNanguCurveNodes(data.cuePathCurveNodes)
      : TROUBLE_HYDRATE_DEFAULT.cuePathCurveNodes,
    objectPathCurveNodes: data.objectPathCurveNodes?.length
      ? cloneNanguCurveNodes(data.objectPathCurveNodes)
      : TROUBLE_HYDRATE_DEFAULT.objectPathCurveNodes,
    explanationText,
  };
}

export function createTroubleSolutionEditorInitialState(
  initialSolutionData?: Partial<NanguSolutionData> | null,
  initialPersistedSettings?: SolutionSettingsValue | null,
  initialContent?: string | null
): TroubleSolutionEditorHydratedState {
  const merged =
    initialSolutionData ??
    (initialPersistedSettings ? { settings: initialPersistedSettings } : null);
  return hydrateTroubleSolutionEditorFromPartial(merged, { initialContent });
}
