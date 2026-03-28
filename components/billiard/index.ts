/**
 * 공통 당구대 모듈
 * - 난구노트, 난구풀이, 해법 작성에서 동일한 캔버스/편집기를 재사용합니다.
 * - 좌표·공 규격은 lib/billiard-table-constants.ts 참고.
 *
 * 주의:
 * - `page/layout/api` 같은 민감한 server entry에서는 이 barrel의 runtime export 대신
 *   가능한 한 leaf path 또는 `import type`만 사용합니다.
 * - 아래 runtime export는 캔버스/에디터 그래프를 포함하므로 client/runtime 경로에서만
 *   사용하는 것을 기본 원칙으로 둡니다.
 */

// Light type exports: 민감한 entry에서 `import type`로만 사용할 것.
export type {
  BallPositions,
  BilliardTableCanvasProps,
  BilliardTableCanvasHandle,
  TableDrawStyle,
} from "./BilliardTableCanvas";
export type {
  BilliardTableEditorProps,
  BilliardTableEditorHandle,
  BilliardTableEditorSnapshot,
  BilliardEditorMode,
} from "./BilliardTableEditor";
export type { BilliardPathLayerProps } from "./BilliardPathLayer";
export type { BilliardShotPanelProps } from "./BilliardShotPanel";
export type { BilliardContactPanelProps } from "./BilliardContactPanel";

// Heavy runtime exports: canvas/editor 사용처만 import.
export { default as BilliardTableCanvas } from "./BilliardTableCanvas";
export { default as BilliardTableEditor } from "./BilliardTableEditor";
export { BilliardPathLayer } from "./BilliardPathLayer";
export { BilliardShotPanel } from "./BilliardShotPanel";
export { BilliardContactPanel } from "./BilliardContactPanel";
