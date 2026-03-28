import { prisma } from "@/lib/db";
import { toIsoString } from "@/lib/format-date";

export type NanguBoardListItemDto = {
  id: string;
  title: string;
  createdAt: string;
  authorName: string;
  solutionCount: number;
};

/** 난구해결사 목록 — API와 동일 데이터(목록 UI는 해법 미리보기 없음). */
export async function getCachedNanguBoardList(): Promise<NanguBoardListItemDto[]> {
  const rows = await prisma.nanguPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      author: { select: { name: true } },
      _count: { select: { solutions: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    createdAt: toIsoString(p.createdAt),
    authorName: p.author.name,
    solutionCount: p._count.solutions,
  }));
}
