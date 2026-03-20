/** 커뮤니티 허브 탭 순서·표시명 (운영 UI 통일) */
export const COMMUNITY_HUB_SLUGS = ["free", "qna", "tips", "reviews", "trouble"] as const;
export type CommunityHubSlug = (typeof COMMUNITY_HUB_SLUGS)[number];

export const COMMUNITY_TAB_LABELS: Record<string, string> = {
  free: "자유게시판",
  qna: "질문",
  tips: "공략",
  reviews: "후기",
  trouble: "난구해결사",
};

export function tabLabelForSlug(slug: string, fallbackName?: string): string {
  return COMMUNITY_TAB_LABELS[slug] ?? fallbackName ?? slug;
}

export function orderedHubBoards<T extends { slug: string; name: string }>(boards: T[]): T[] {
  const map = new Map(boards.map((b) => [b.slug, b]));
  const ordered: T[] = [];
  for (const slug of COMMUNITY_HUB_SLUGS) {
    const b = map.get(slug);
    if (b) ordered.push(b);
  }
  return ordered;
}
