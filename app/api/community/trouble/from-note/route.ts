import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isFeatureEnabled } from "@/lib/site-feature-flags";

/** 노트에서 난구해결(community/trouble) 게시글 생성. CommunityPost + TroubleShotPost 생성 후 postId 반환 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const writeEnabled = await isFeatureEnabled("community_write_enabled");
  if (!writeEnabled) {
    return NextResponse.json({ error: "현재 커뮤니티 글쓰기가 중단되었습니다." }, { status: 503 });
  }

  let body: { noteId: string; title: string; content: string; imageUrl?: string | null; difficulty?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const noteId = (body.noteId ?? "").trim();
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "노트 ID가 필요합니다." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });

  const note = await prisma.billiardNote.findUnique({
    where: { id: noteId },
    select: { id: true, authorId: true, imageUrl: true },
  });
  if (!note || note.authorId !== session.id) {
    return NextResponse.json({ error: "해당 노트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
  }

  const board = await prisma.communityBoard.findUnique({
    where: { slug: "trouble" },
    select: { id: true },
  });
  if (!board) {
    return NextResponse.json({ error: "난구해결 게시판을 찾을 수 없습니다." }, { status: 404 });
  }

  const layoutImageUrl = (body.imageUrl ?? note.imageUrl)?.trim() || null;
  const difficulty = (body.difficulty ?? "")?.trim() || null;

  const post = await prisma.communityPost.create({
    data: {
      boardId: board.id,
      authorId: session.id,
      title,
      content: content || " ",
    },
  });
  await prisma.troubleShotPost.create({
    data: {
      postId: post.id,
      sourceNoteId: note.id,
      layoutImageUrl,
      difficulty,
    },
  });
  return NextResponse.json({ id: post.id });
}
