/**
 * 트러블/난구 경로 재생 상세 로그 — 기본 OFF (dev에서도 콘솔·메인 스레드 부하 방지).
 * 세그먼트 감사, ease-cue/object 프레임 로그, settings-source 등은 이 플래그가 true일 때만.
 */
export function isTroublePlaybackVerboseLogEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_TROUBLE_PLAYBACK_LOGS === "true";
}

/**
 * 재생 이징(raw vs eased, motionMs, dAlong, cap) 감사 — 기본 OFF.
 * `.env.local`에 `NEXT_PUBLIC_DEBUG_PATH_PLAYBACK_EASING_AUDIT=true` 후 재생 시 콘솔 확인.
 */
export function isPathPlaybackEasingAuditEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_PATH_PLAYBACK_EASING_AUDIT === "true";
}
