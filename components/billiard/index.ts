/**
 * 공통 당구대 모듈
 * - 당구노트, 난구풀이, 해법 작성에서 동일한 캔버스/편집기를 재사용합니다.
 * - 좌표·공 규격은 lib/billiard-table-constants.ts 참고.
 */
export { default as BilliardTableCanvas } from "./BilliardTableCanvas";
export type {
  BallPositions,
  BilliardTableCanvasProps,
  BilliardTableCanvasHandle,
  TableDrawStyle,
} from "./BilliardTableCanvas";

export { default as BilliardTableEditor } from "./BilliardTableEditor";
export type {
  BilliardTableEditorProps,
  BilliardTableEditorHandle,
  BilliardTableEditorSnapshot,
  BilliardEditorMode,
} from "./BilliardTableEditor";

export { BilliardPathLayer } from "./BilliardPathLayer";
export type { BilliardPathLayerProps } from "./BilliardPathLayer";

export { BilliardShotPanel } from "./BilliardShotPanel";
export type { BilliardShotPanelProps } from "./BilliardShotPanel";

export { BilliardContactPanel } from "./BilliardContactPanel";
export type { BilliardContactPanelProps } from "./BilliardContactPanel";
