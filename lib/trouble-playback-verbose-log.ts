/**
 * 트러블/난구 경로 재생 상세 로그 — 기본 OFF (dev에서도 콘솔·메인 스레드 부하 방지).
 * 세그먼트 감사, ease-cue/object 프레임 로그, settings-source 등은 이 플래그가 true일 때만.
 */
export function isTroublePlaybackVerboseLogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_TROUBLE_PLAYBACK_LOGS === "true";
}
