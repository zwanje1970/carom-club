/**
 * 난구해결사(Trouble) 해법 제시 콘솔 — UI 계약 (스킨/SVG 교체 시 유지)
 *
 * - 버튼·레이아웃·Tailwind·SVG는 바꿔도 됨.
 * - 아래 data-* 값과 연결된 핸들러(onClick/onSubmit)·상태·API 페이로드는 깨지면 안 됨.
 * - 새 컨트롤을 감싸도 최종 클릭 타겟에 동일한 data-trouble-action 을 남길 것.
 */
export const TROUBLE_SOLUTION_CONSOLE = {
  /** 루트: 전체 해법 폼 (이 노드 하위만 스킨 교체 권장) */
  root: "trouble-solution-console",
  region: {
    /** 원본 공배치 미리보기 + 경로 표시(보기 전용). 스팟 추가는 전체화면에서만 */
    readonlyLayout: "trouble-readonly-layout",
    /** 전체화면 열기·저장된 경로 지우기 등 */
    pathToolbar: "trouble-path-toolbar",
    /** 두께/당점/스트로크/스피드/경로 탭 + 패널 본문 */
    settings: "trouble-settings",
    /** 해설 textarea */
    explanation: "trouble-explanation",
    /** 충돌 경고 토스트/오버레이 */
    collisionWarning: "trouble-collision-warning",
    /** 경로 재생 중 시각 옵션(경로선/그리드/실사) */
    playbackViewControls: "trouble-playback-view-controls",
  },
  /** 클릭·포커스 타겟용 (E2E·SVG 래퍼·에이전트가 이 이름으로 찾음) */
  action: {
    togglePathMode: "trouble-toggle-path-mode",
    /** 1목적구 경로선 그리기 모드 토글 (탭하지 않으면 1목 경로 편집 비활성) */
    toggleObjectPathMode: "trouble-toggle-object-path-mode",
    clearPath: "trouble-clear-path",
    panelThickness: "trouble-panel-thickness",
    panelSpin: "trouble-panel-spin",
    panelBackstroke: "trouble-panel-backstroke",
    panelFollowstroke: "trouble-panel-followstroke",
    panelSpeed: "trouble-panel-speed",
    panelPath: "trouble-panel-path",
    /** 폼 submit — type="submit" 유지 권장 */
    submitSolution: "trouble-submit-solution",
    /** 경로 재생 / 애니메이션 시연 (수구→1목) */
    playPath: "trouble-play-path",
    /** 마지막 추가 스팟·선 Undo */
    undoLastPathSpot: "trouble-undo-last-path-spot",
    /** 수구·1목 경로·스팟·화살표 전체 초기화 (공 배치 유지) */
    clearAllPaths: "trouble-clear-all-paths",
    /** 충돌 메시지 닫기 */
    dismissCollision: "trouble-dismiss-collision",
    /** 재생 중: 경로선 표시 토글 */
    playbackTogglePathlines: "trouble-playback-toggle-pathlines",
    /** 재생 중: 그리드 표시 토글 */
    playbackToggleGrid: "trouble-playback-toggle-grid",
    /** 재생 중: 실사/단순보기 토글 */
    playbackToggleDrawstyle: "trouble-playback-toggle-drawstyle",
  },
} as const;

export type TroubleSolutionConsoleAction =
  (typeof TROUBLE_SOLUTION_CONSOLE.action)[keyof typeof TROUBLE_SOLUTION_CONSOLE.action];
