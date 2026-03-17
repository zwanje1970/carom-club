import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { awardCommentLikeReceived, revokeCommentLikeReceived } from "@/lib/community-score-service";
import { getLevelFromScore } from "@/lib/community-level";

/** 댓글 추천(좋아요) 토글. Lv2 이상만 가능. 좋아요 시 댓글 작성자에게 +1점(게시글당 최대 +3). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const commentId = (await params).id;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { communityScore: true },
  });
  const level = user ? getLevelFromScore(user.communityScore) : 1;
  if (level < 2) {
    return NextResponse.json({ error: "댓글·좋아요는 레벨 2 이상부터 가능합니다." }, { status: 403 });
  }

  const comment = await prisma.communityComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, postId: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const existing = await prisma.communityCommentLike.findUnique({
    where: { commentId_userId: { commentId, userId: session.id } },
  });
  if (existing) {
    await prisma.communityCommentLike.delete({
      where: { commentId_userId: { commentId, userId: session.id } },
    });
    try {
      await revokeCommentLikeReceived(comment.authorId, commentId);
    } catch (_) {}
    return NextResponse.json({ liked: false });
  }
  await prisma.communityCommentLike.create({
    data: { commentId, userId: session.id },
  });
  if (comment.authorId !== session.id) {
    try {
      await awardCommentLikeReceived(comment.authorId, commentId, comment.postId, session.id);
    } catch (_) {}
  }
  return NextResponse.json({ liked: true });
}
