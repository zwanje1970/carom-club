import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageReports } from "@/lib/community-roles";
import { revalidateCommunityNoticePinned } from "@/lib/community-notice-pinned-revalidate";

/** 신고 상세 (GET) 및 처리 (PATCH): 상태 변경, 관리자 메모, 게시글/댓글 숨김 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canManageReports(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await context.params;

  const report = await prisma.communityReport.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true, username: true } },
      post: {
        select: {
          id: true,
          title: true,
          content: true,
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
  if (!report) {
    return NextResponse.json({ error: "신고를 찾을 수 없습니다." }, { status: 404 });
  }

  const reasonLabels: Record<string, string> = {
    PROFANITY: "욕설/비방",
    AD_SPAM: "광고/도배",
    INAPPROPRIATE: "음란/부적절",
    MISINFO: "허위 정보",
    CONFLICT: "분쟁 유발",
    OTHER: "기타",
  };

  return NextResponse.json({
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    postId: report.postId,
    commentId: report.commentId,
    reason: report.reason,
    reasonLabel: reasonLabels[report.reason] ?? report.reason,
    status: report.status,
    adminMemo: report.adminMemo,
    processedAt: report.processedAt?.toISOString() ?? null,
    processedBy: report.processedBy,
    createdAt: report.createdAt.toISOString(),
    reporter: report.reporter ? { id: report.reporter.id, name: report.reporter.name, username: report.reporter.username } : null,
    post: report.post
      ? {
          id: report.post.id,
          title: report.post.title,
          content: report.post.content,
          boardSlug: report.post.board?.slug,
          boardName: report.post.board?.name,
          isHidden: report.post.isHidden,
        }
      : null,
    comment: report.comment
      ? {
          id: report.comment.id,
          content: report.comment.content,
          postId: report.comment.postId,
          postTitle: report.comment.post?.title,
          boardSlug: report.comment.post?.board?.slug,
          boardName: report.comment.post?.board?.name,
          isHidden: report.comment.isHidden,
        }
      : null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canManageReports(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await context.params;

  const report = await prisma.communityReport.findUnique({
    where: { id },
    select: { id: true, postId: true, commentId: true },
  });
  if (!report) {
    return NextResponse.json({ error: "신고를 찾을 수 없습니다." }, { status: 404 });
  }

  let body: { status?: string; adminMemo?: string; hidePost?: boolean; hideComment?: boolean; unhidePost?: boolean; unhideComment?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const statusAllowed = ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"];
  if (body.status != null && !statusAllowed.includes(body.status)) {
    return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const update: { status?: string; adminMemo?: string; processedAt?: Date; processedBy?: string } = {};
    if (body.status != null) {
      update.status = body.status;
      update.processedAt = new Date();
      update.processedBy = session.id;
    }
    if (body.adminMemo !== undefined) update.adminMemo = body.adminMemo;
    if (Object.keys(update).length > 0) {
      await tx.communityReport.update({
        where: { id },
        data: update,
      });
    }
    if (body.hidePost === true && report.postId) {
      await tx.communityPost.update({
        where: { id: report.postId },
        data: { isHidden: true },
      });
    }
    if (body.unhidePost === true && report.postId) {
      await tx.communityPost.update({
        where: { id: report.postId },
        data: { isHidden: false },
      });
    }
    if (body.hideComment === true && report.commentId) {
      await tx.communityComment.update({
        where: { id: report.commentId },
        data: { isHidden: true },
      });
    }
    if (body.unhideComment === true && report.commentId) {
      await tx.communityComment.update({
        where: { id: report.commentId },
        data: { isHidden: false },
      });
    }
  });

  if ((body.hidePost === true || body.unhidePost === true) && report.postId) {
    const post = await prisma.communityPost.findUnique({
      where: { id: report.postId },
      select: { boardId: true, board: { select: { slug: true } } },
    });
    if (post?.board.slug === "notice") {
      revalidateCommunityNoticePinned(post.boardId);
    }
  }

  return NextResponse.json({ ok: true });
}
