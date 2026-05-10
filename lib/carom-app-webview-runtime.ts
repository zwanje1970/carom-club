/**
 * 브라우저에서 캐롬클럽 앱 WebView 여부를 판별한다.
 * `lib/is-carom-club-mobile-app-shell.ts`(요청 헤더·환경)와 동일한 UA·브릿지 신호를 본다.
 * 서버에서 놓친 요청도 클라이언트 복구용으로 사용한다.
 */
export function isCaromAppWebViewRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const bridge = (window as Window & { CaromAppBridge?: unknown }).CaromAppBridge;
    if (bridge != null && typeof bridge === "object") return true;
  } catch {
    /* ignore */
  }
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (ua.includes("; wv)") || ua.includes("; wv ")) return true;
  if (ua.includes("caromclubapp") || ua.includes("carom-club-app")) return true;
  return false;
}
