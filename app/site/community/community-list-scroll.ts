/** 커뮤니티 목록 스크롤 복원용 — 게시판(탭)·URL 쿼리가 바뀌면 서명이 달라진다 */
export function buildCommunityListScrollSignature(
  boardListKey: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const keys = Object.keys(searchParams).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = searchParams[k];
    if (Array.isArray(v)) parts.push(`${k}=${[...v].map(String).sort().join(",")}`);
    else if (typeof v === "string") parts.push(`${k}=${v}`);
  }
  const q = parts.join("|") || "__defaultQuery";
  return `board=${boardListKey}|${q}`;
}
