import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { parseTroubleBallPlacementJson } from "@/lib/trouble-ball-placement";

/**
 * 난구해결(trouble) 게시글 조회 - 해법 작성 페이지용.
 * CommunityPost.id(postId) 기준으로 trouble 글만 반환하며,
 * 공배치/제목/설명 등 해법 작성 화면에 필요한 필드만 내려준다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { postId } = await params;

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      board: { select: { slug: true } },
      troubleShot: {
        select: {
          id: true,
          layoutImageUrl: true,
          ballPlacementJson: true,
          difficulty: true,
        },
      },
    },
  });

  if (!post || post.board.slug !== "trouble" || !post.troubleShot) {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }

  const ballPlacement = parseTroubleBallPlacementJson(post.troubleShot.ballPlacementJson);

  return NextResponse.json({
    id: post.id,
    title: post.title,
    content: post.content ?? "",
    layoutImageUrl: post.troubleShot.layoutImageUrl ?? null,
    ballPlacement,
    difficulty: post.troubleShot.difficulty ?? null,
  });
}
