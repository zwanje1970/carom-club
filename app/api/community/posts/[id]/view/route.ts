import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const VIEW_DEDUP_HOURS = 24;

/** 상세 페이지 실제 진입 시에만 호출. viewerKey(또는 userId 기반 키)로 24시간 내 중복 조회 방지 후 viewCount 증가 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { id: postId } = await params;

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, board: { select: { slug: true } } },
  });
  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }

  const session = await getSession();
  if (post.board.slug === "trouble" && !session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const viewerKey = (body.viewerKey as string)?.trim() || (request.headers.get("x-viewer-key") ?? "").trim();

  // 로그인 사용자: userId 기반 키 사용. 비로그인: 클라이언트에서 전달한 viewerKey 필수
  const key = session ? `user:${session.id}` : viewerKey;
  if (!key) {
    return NextResponse.json({ error: "viewerKey가 필요합니다." }, { status: 400 });
  }

  const since = new Date();
  since.setHours(since.getHours() - VIEW_DEDUP_HOURS);

  try {
    const existing = await prisma.communityPostView.findUnique({
      where: { postId_viewerKey: { postId, viewerKey: key } },
      select: { viewedAt: true },
    });

    if (existing && existing.viewedAt >= since) {
      return NextResponse.json({ counted: false, viewCount: undefined });
    }

    await prisma.$transaction([
      existing
        ? prisma.communityPostView.update({
            where: { postId_viewerKey: { postId, viewerKey: key } },
            data: { viewedAt: new Date(), userId: session?.id ?? null },
          })
        : prisma.communityPostView.create({
            data: {
              postId,
              viewerKey: key,
              userId: session?.id ?? null,
            },
          }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
      }),
    ]);

    const updated = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { viewCount: true },
    });
    return NextResponse.json({ counted: true, viewCount: updated?.viewCount ?? 0 });
  } catch (e) {
    const err = e as Error & { code?: string };
    console.error("[posts/view] 조회수 반영 실패:", err.message, err.code);
    return NextResponse.json(
      {
        error: "조회수를 반영할 수 없습니다. DB 마이그레이션을 확인하세요.",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
