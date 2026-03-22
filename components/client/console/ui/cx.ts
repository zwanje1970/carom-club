/** /client 콘솔 UI 전용 클래스 병합 (외부 cn 유틸과 분리) */
export function cx(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}
