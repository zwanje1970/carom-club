/**
 * next/image 사용 전 src 검사
 * - data:, blob:, 빈 문자열, undefined → next/image 최적화 파이프라인 통과 불가 → 일반 img 사용 권장
 * - 유효한 https 또는 / 로 시작하는 URL만 next/image로 처리
 */

/**
 * 이미지 URL로 허용할 값인지 검사. 폼/API 검증용.
 * - 빈 문자열 → 허용 (미입력)
 * - / 로 시작 (상대경로, 예: /uploads/billiard/xxx.webp) → 허용
 * - http://, https:// → 허용
 * - 그 외 → false
 */
export function isAllowedImageUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== "string") return true;
  const s = url.trim();
  if (s === "") return true;
  if (s.startsWith("/")) return true;
  if (s.startsWith("http://") || s.startsWith("https://")) return true;
  return false;
}

/** next/image 최적화를 사용해도 되는 src인지 (false면 일반 <img> 사용 권장) */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (src == null || typeof src !== "string") return false;
  const s = src.trim();
  if (s === "") return false;
  if (s.startsWith("data:") || s.startsWith("blob:")) return false;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return true;
  return false;
}

/**
 * img/Image에 넣어도 되는 유효한 src.
 * - undefined, null, "", javascript: → null
 * - 상대 경로(예: uploads/foo.jpg) → 앞에 / 붙여 절대 경로로 (배포 시 같은 오리진 기준)
 */
export function sanitizeImageSrc(src: string | null | undefined): string | null {
  if (src == null || typeof src !== "string") return null;
  const s = src.trim();
  if (s === "" || s.startsWith("javascript:")) return null;
  if (
    !s.startsWith("http://") &&
    !s.startsWith("https://") &&
    !s.startsWith("/") &&
    !s.startsWith("data:") &&
    !s.startsWith("blob:")
  ) {
    return `/${s}`;
  }
  return s;
}

/** 이미지 src 무효 시 사용할 placeholder (data URL, 파일 불필요) */
export const IMAGE_PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%239ca3af' font-size='12'%3E?%3C/text%3E%3C/svg%3E";
