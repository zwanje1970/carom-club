import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageReports } from "@/lib/community-roles";

const REASON_LABELS: Record<string, string> = {
  PROFANITY: "욕설/비방",
  AD_SPAM: "광고/도배",
  INAPPROPRIATE: "음란/부적절",
  MISINFO: "허위 정보",
  CONFLICT: "분쟁 유발",
  OTHER: "기타",
};

/** 신고 목록 (MODERATOR 이상) */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canManageReports(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const list = await prisma.communityReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      reporter: { select: { id: true, name: true, username: true } },
      post: {
        select: {
          id: true,
          title: true,
          boardId: true,
          authorId: true,
          isHidden: true,
          board: { select: { slug: true, name: true } },
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          postId: true,
          authorId: true,
          isHidden: true,
          post: { select: { id: true, title: true, board: { select: { slug: true, name: true } } } },
        },
      },
    },
  });

  const items = list.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    postId: r.postId,
    commentId: r.commentId,
    reason: r.reason,
    reasonLabel: REASON_LABELS[r.reason] ?? r.reason,
    status: r.status,
    adminMemo: r.adminMemo,
    processedAt: r.processedAt?.toISOString() ?? null,
    processedBy: r.processedBy,
    createdAt: r.createdAt.toISOString(),
    reporter: r.reporter ? { id: r.reporter.id, name: r.reporter.name, username: r.reporter.username } : null,
    post: r.post
      ? {
          id: r.post.id,
          title: r.post.title,
          boardSlug: r.post.board?.slug,
          boardName: r.post.board?.name,
          isHidden: r.post.isHidden,
        }
      : null,
    comment: r.comment
      ? {
          id: r.comment.id,
          content: r.comment.content,
          postId: r.comment.postId,
          postTitle: r.comment.post?.title,
          boardSlug: r.comment.post?.board?.slug,
          boardName: r.comment.post?.board?.name,
          isHidden: r.comment.isHidden,
        }
      : null,
  }));

  return NextResponse.json({ items });
}
