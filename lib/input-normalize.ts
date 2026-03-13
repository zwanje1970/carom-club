/**
 * 폼 입력 시 전각(Fullwidth) 문자가 들어오는 문제 대응.
 * IME/브라우저/폰트 조합에 따라 전각 ASCII·숫자가 입력될 수 있으므로,
 * 반각(Halfwidth)으로 정규화해 저장·표시를 일치시킵니다.
 */

/** 전각 ASCII·숫자를 반각으로 변환 (NFKC 정규화 후 전각→반각 매핑) */
export function toHalfwidth(str: string): string {
  if (typeof str !== "string") return str;
  return str.normalize("NFKC");
}
