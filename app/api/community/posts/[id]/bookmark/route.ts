import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 북마크 토글 */
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
  const postId = (await params).id;

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }

  const existing = await prisma.communityBookmark.findUnique({
    where: { userId_postId: { userId: session.id, postId } },
  });
  if (existing) {
    await prisma.communityBookmark.delete({
      where: { userId_postId: { userId: session.id, postId } },
    });
    return NextResponse.json({ bookmarked: false });
  }
  await prisma.communityBookmark.create({
    data: { userId: session.id, postId },
  });
  return NextResponse.json({ bookmarked: true });
}
