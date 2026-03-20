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
    /** 원본 공배치 + 경로 오버레이 (클릭으로 스팟 추가는 pathMode 일 때만) */
    readonlyLayout: "trouble-readonly-layout",
    /** 진행경로 토글·전체선 삭제 */
    pathToolbar: "trouble-path-toolbar",
    /** 두께/당점/스트로크/스피드/경로 탭 + 패널 본문 */
    settings: "trouble-settings",
    /** 해설 textarea */
    explanation: "trouble-explanation",
    /** 충돌 경고 토스트/오버레이 */
    collisionWarning: "trouble-collision-warning",
  },
  /** 클릭·포커스 타겟용 (E2E·SVG 래퍼·에이전트가 이 이름으로 찾음) */
  action: {
    togglePathMode: "trouble-toggle-path-mode",
    clearPath: "trouble-clear-path",
    panelThickness: "trouble-panel-thickness",
    panelSpin: "trouble-panel-spin",
    panelBackstroke: "trouble-panel-backstroke",
    panelFollowstroke: "trouble-panel-followstroke",
    panelSpeed: "trouble-panel-speed",
    panelPath: "trouble-panel-path",
    /** 폼 submit — type="submit" 유지 권장 */
    submitSolution: "trouble-submit-solution",
    /** 경로 재생 (수구→1목) */
    playPath: "trouble-play-path",
    /** 충돌 메시지 닫기 */
    dismissCollision: "trouble-dismiss-collision",
  },
} as const;

export type TroubleSolutionConsoleAction =
  (typeof TROUBLE_SOLUTION_CONSOLE.action)[keyof typeof TROUBLE_SOLUTION_CONSOLE.action];
