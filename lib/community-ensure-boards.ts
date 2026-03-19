/**
 * 커뮤니티 기본 게시판 보장.
 * 시드를 안 돌린 DB에서도 난구해결사(trouble) 등 기본 게시판이 없으면 자동 생성.
 * 코드에서 사용하는 slug와 여기 정의가 정확히 일치해야 함.
 */

import { prisma } from "@/lib/db";

/** 코드에서 참조하는 게시판 slug (API/라우트와 일치) */
export const DEFAULT_BOARD_SLUGS = [
  "notice",
  "free",
  "qna",
  "tips",
  "reviews",
  "trouble", // 난구해결사
] as const;

const DEFAULT_BOARDS: Array<{
  slug: string;
  name: string;
  description: string | null;
  type: string;
  sortOrder: number;
}> = [
  { slug: "notice", name: "공지사항", description: "관리자 공지", type: "notice", sortOrder: 0 },
  { slug: "free", name: "자유게시판", description: "일반 커뮤니티", type: "free", sortOrder: 1 },
  { slug: "qna", name: "질문/Q&A", description: "당구 기술·장비·룰 질문", type: "qna", sortOrder: 2 },
  { slug: "tips", name: "공략/팁", description: "당구 공략과 팁", type: "tips", sortOrder: 3 },
  { slug: "reviews", name: "후기", description: "장비·당구장·대회 후기", type: "reviews", sortOrder: 4 },
  { slug: "trouble", name: "난구해결사", description: "문제구 질문 및 해법 토론", type: "trouble", sortOrder: 5 },
];

/**
 * 기본 커뮤니티 게시판이 없으면 생성(upsert). 시드와 동일한 slug/name/type 사용.
 * API에서 게시판을 찾지 못했을 때 호출 후 재조회하면 됨.
 */
export async function ensureDefaultCommunityBoards(): Promise<void> {
  for (const b of DEFAULT_BOARDS) {
    await prisma.communityBoard.upsert({
      where: { slug: b.slug },
      create: { ...b, isActive: true },
      update: {
        name: b.name,
        description: b.description,
        type: b.type,
        sortOrder: b.sortOrder,
      },
    });
  }
}
