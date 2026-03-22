import type { BallSpeed } from "@/lib/ball-speed-constants";
import type { NanguPathPoint } from "@/lib/nangu-types";

export type NanguActivePanel =
  | "thickness"
  | "spin"
  | "backstroke"
  | "followstroke"
  | "speed"
  | "path";

/** 해법 제시 폼 되돌리기(undo)용 스냅샷 — transient UI(확대 오버레이 등) 제외 */
export type NanguSolutionEditorUndoSnapshot = {
  activePanel: NanguActivePanel;
  isBankShot: boolean;
  thicknessOffsetX: number;
  spinX: number;
  spinY: number;
  backstrokeLevel: number;
  followStrokeLevel: number;
  ballSpeed: BallSpeed;
  pathPoints: NanguPathPoint[];
  explanationText: string;
};

export const NANGU_SOLUTION_EDITOR_MAX_UNDO = 30;

export function cloneNanguSolutionEditorSnapshot(
  s: NanguSolutionEditorUndoSnapshot
): NanguSolutionEditorUndoSnapshot {
  return {
    ...s,
    pathPoints: s.pathPoints.map((p) => ({ ...p })),
  };
}

export function createInitialNanguSolutionEditorSnapshot(): NanguSolutionEditorUndoSnapshot {
  return {
    activePanel: "thickness",
    isBankShot: false,
    thicknessOffsetX: 0.5,
    spinX: 0,
    spinY: 0,
    backstrokeLevel: 5,
    followStrokeLevel: 5,
    ballSpeed: 3.0,
    pathPoints: [],
    explanationText: "",
  };
}
