import { prisma } from "@/lib/db";

/** 댓글 삭제·캐시 불일치 시 게시글의 commentCount를 실제 건수로 맞춤 */
export async function syncCommunityPostCommentCount(postId: string): Promise<void> {
  const n = await prisma.communityComment.count({ where: { postId } });
  await prisma.communityPost.update({
    where: { id: postId },
    data: { commentCount: n },
  });
}

/** 좋아요 토글 후 likeCount를 실제 건수로 맞춤 (increment 대신 정확도 우선, 드문 호출) */
export async function syncCommunityPostLikeCount(postId: string): Promise<void> {
  const n = await prisma.communityPostLike.count({ where: { postId } });
  await prisma.communityPost.update({
    where: { id: postId },
    data: { likeCount: n },
  });
}
