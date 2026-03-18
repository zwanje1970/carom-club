/**
 * next/image 사용 전 src 검사
 * - data:, blob:, 빈 문자열, undefined → next/image 최적화 파이프라인 통과 불가 → 일반 img 사용 권장
 * - 유효한 https 또는 / 로 시작하는 URL만 next/image로 처리
 */

/** next/image 최적화를 사용해도 되는 src인지 (false면 일반 <img> 사용 권장) */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (src == null || typeof src !== "string") return false;
  const s = src.trim();
  if (s === "") return false;
  if (s.startsWith("data:") || s.startsWith("blob:")) return false;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return true;
  return false;
}

/** img/Image에 넣어도 되는 유효한 src 문자열 반환 (무효면 빈 문자열) */
export function sanitizeImageSrc(src: string | null | undefined): string {
  if (src == null || typeof src !== "string") return "";
  const s = src.trim();
  if (s === "" || s.startsWith("javascript:")) return "";
  return s;
}
