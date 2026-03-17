import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isCommunityModerator } from "@/lib/community-roles";
import { isFeatureEnabled } from "@/lib/site-feature-flags";

/** 댓글 목록 (대댓글 포함, parentId 기준 트리). 숨김 댓글은 관리자만 내용 표시 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const postId = (await params).id;
  const session = await getSession();
  const canSeeHidden = isCommunityModerator(session);

  const comments = await prisma.communityComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      parentId: true,
      authorId: true,
      content: true,
      isHidden: true,
      createdAt: true,
      author: { select: { name: true } },
      _count: { select: { likes: true } },
    },
  });

  const userId = session?.id;
  const likedIds = userId
    ? (
        await prisma.communityCommentLike.findMany({
          where: { userId, commentId: { in: comments.map((c) => c.id) } },
          select: { commentId: true },
        })
      ).map((r) => r.commentId)
    : [];

  const mapOne = (c: (typeof comments)[0]) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.author.name,
    content: c.isHidden && !canSeeHidden ? "관리자에 의해 숨김 처리된 내용입니다." : c.content,
    isHidden: c.isHidden,
    likeCount: c._count.likes,
    createdAt: c.createdAt.toISOString(),
    isAuthor: userId === c.authorId,
    liked: likedIds.includes(c.id),
  });

  const byParent = new Map<string | null, ReturnType<typeof mapOne>[]>();
  byParent.set(null, []);
  comments.forEach((c) => {
    const item = mapOne(c);
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  });

  const withReplies = (parentKey: string | null): ReturnType<typeof mapOne>[] => {
    const list = byParent.get(parentKey) ?? [];
    return list.map((item) => ({
      ...item,
      replies: withReplies(item.id),
    }));
  };

  const topLevel = withReplies(null);
  return NextResponse.json(topLevel);
}

/** 댓글 작성. parentId 있으면 대댓글. 알림: 글 작성자 또는 부모 댓글 작성자(본인 제외) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const commentEnabled = await isFeatureEnabled("community_comment_enabled");
  if (!commentEnabled) {
    return NextResponse.json({ error: "현재 댓글 작성이 중단되었습니다." }, { status: 503 });
  }
  const postId = (await params).id;

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: { content: string; parentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "댓글 내용을 입력하세요." }, { status: 400 });

  let parentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (body.parentId) {
    const parent = await prisma.communityComment.findUnique({
      where: { id: body.parentId, postId },
      select: { id: true, authorId: true },
    });
    if (!parent) return NextResponse.json({ error: "부모 댓글을 찾을 수 없습니다." }, { status: 400 });
    parentId = parent.id;
    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.communityComment.create({
    data: { postId, authorId: session.id, content, parentId },
  });

  const notifyUserId = parentId ? parentAuthorId : post.authorId;
  if (notifyUserId && notifyUserId !== session.id) {
    await prisma.communityNotification.create({
      data: {
        userId: notifyUserId,
        type: parentId ? "reply_to_comment" : "comment_on_post",
        postId,
        commentId: comment.id,
        relatedUserId: session.id,
      },
    });
  }

  return NextResponse.json({
    id: comment.id,
    parentId: comment.parentId,
    authorName: session.name,
    content: comment.content,
    likeCount: 0,
    createdAt: comment.createdAt.toISOString(),
    isAuthor: true,
    liked: false,
    replies: [],
  });
}
