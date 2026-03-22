import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { syncCommunityPostCommentCount } from "@/lib/community-post-counts";

/** 댓글 삭제. 작성자만 */
export async function DELETE(
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
  const { id } = await params;

  const comment = await prisma.communityComment.findUnique({
    where: { id },
    select: { authorId: true, postId: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (comment.authorId !== session.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const postId = comment.postId;
  await prisma.communityComment.delete({ where: { id } });
  await syncCommunityPostCommentCount(postId);
  return NextResponse.json({ ok: true });
}
