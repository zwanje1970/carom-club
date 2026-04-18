/** 직접입력 HTML이 비어 있는지(공백·빈 문단만) 판별 */
export function isEmptyOutlineHtml(html: string): boolean {
  const s = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length === 0;
}
