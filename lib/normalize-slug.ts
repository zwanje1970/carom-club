/**
 * Prisma Organization.slug는 string | null 이지만,
 * UI/컴포넌트 props에서는 slug: string으로 통일하기 위한 공용 정규화.
 * DB 조회 결과를 컴포넌트에 넘기기 직전에 적용할 것.
 */

/** slug 필드가 있는 단일 객체: slug를 string으로 보정 (null/undefined → "") */
export function normalizeSlug<T extends { slug?: string | null }>(
  item: T
): Omit<T, "slug"> & { slug: string } {
  return { ...item, slug: item.slug ?? "" } as Omit<T, "slug"> & { slug: string };
}

/** slug 필드가 있는 객체 배열 전체 보정 */
export function normalizeSlugs<T extends { slug?: string | null }>(
  items: T[]
): (Omit<T, "slug"> & { slug: string })[] {
  return items.map(normalizeSlug);
}

/** organization 필드가 있는 객체: organization.slug 보정 (nested) */
export function normalizeOrgSlug<T extends { organization?: { slug?: string | null } | null }>(
  item: T
): T {
  const org = item.organization;
  if (!org) return item;
  return {
    ...item,
    organization: { ...org, slug: org.slug ?? "" },
  } as T;
}

/** organization이 있는 객체 배열 전체에 대해 organization.slug 보정 */
export function normalizeOrgSlugs<T extends { organization?: { slug?: string | null } | null }>(
  items: T[]
): T[] {
  return items.map(normalizeOrgSlug);
}
