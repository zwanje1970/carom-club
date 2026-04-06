import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TAKE = 30;

/** 마이페이지 커뮤니티: 내가 쓴 글, 내 댓글, 내가 받은 추천, 북마크한 글 */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "posts";

  if (tab === "posts") {
    const posts = await prisma.communityPost.findMany({
      where: { authorId: session.id },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
      },
    });
    return NextResponse.json({
      tab: "posts",
      items: posts.map((p) => ({
        id: p.id,
        title: p.title,
        boardSlug: p.board.slug,
        boardName: p.board.name,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }

  if (tab === "comments") {
    const comments = await prisma.communityComment.findMany({
      where: { authorId: session.id },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        content: true,
        createdAt: true,
        _count: { select: { likes: true } },
        post: { select: { id: true, title: true, board: { select: { slug: true, name: true } } } },
      },
    });
    return NextResponse.json({
      tab: "comments",
      items: comments.map((c) => ({
        id: c.id,
        content: c.content,
        likeCount: c._count.likes,
        createdAt: c.createdAt.toISOString(),
        postId: c.post.id,
        postTitle: c.post.title,
        boardSlug: c.post.board.slug,
        boardName: c.post.board.name,
      })),
    });
  }

  if (tab === "received-likes") {
    const posts = await prisma.communityPost.findMany({
      where: { authorId: session.id, likes: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        title: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
      },
    });
    return NextResponse.json({
      tab: "received-likes",
      items: posts.map((p) => ({
        id: p.id,
        title: p.title,
        boardSlug: p.board.slug,
        boardName: p.board.name,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }

  if (tab === "bookmarks") {
    const bookmarks = await prisma.communityBookmark.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        postId: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            likeCount: true,
            commentCount: true,
            createdAt: true,
            board: { select: { slug: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json({
      tab: "bookmarks",
      items: bookmarks.map((b) => ({
        id: b.post.id,
        title: b.post.title,
        boardSlug: b.post.board.slug,
        boardName: b.post.board.name,
        likeCount: b.post.likeCount,
        commentCount: b.post.commentCount,
        createdAt: b.post.createdAt.toISOString(),
        bookmarkedAt: b.createdAt.toISOString(),
      })),
    });
  }

  return NextResponse.json({ error: "잘못된 tab" }, { status: 400 });
}
