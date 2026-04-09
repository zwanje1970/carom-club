/**
 * 서버 요청 헤더 기반의 간단한 기기 판별.
 * `true`면 모바일(또는 모바일 성격의 UA)로 간주한다.
 */
export function isLikelyMobileRequest(headerValue: string | null | undefined): boolean {
  if (!headerValue) return false;
  return /(Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|Opera Mini)/i.test(headerValue);
}

