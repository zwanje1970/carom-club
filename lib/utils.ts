/**
 * 클래스 네임을 조건부로 합쳐주는 유틸리티 함수입니다.
 */
export function cn(...inputs: (string | boolean | undefined | null | { [key: string]: boolean | undefined | null })[]) {
  const classes = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string") {
      classes.push(input);
    } else if (Array.isArray(input)) {
      // Array support if needed, but not implemented here for simplicity
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(" ");
}
