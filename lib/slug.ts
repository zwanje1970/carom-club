/**
 * Organization URL slug 생성/검증
 * - 소문자, 공백 제거, 특수문자 제거, 영어 slug
 * - 한글만 있는 경우 fallback "org" 후 ensureUniqueSlug에서 billion-2 형식
 */

/** 이름 → URL용 slug (영문 소문자, 숫자, 하이픈만). 한글/특수문자 제거 */
export function nameToSlug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "org";
}

/** base slug가 이미 있으면 billion-2, billion-3 형식으로 고유 slug 반환 */
export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = base;
  let n = 0;
  while (await exists(slug)) {
    n += 1;
    slug = n === 1 ? `${base}-2` : `${base}-${n + 1}`;
  }
  return slug;
}
