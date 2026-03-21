import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import { ensureDefaultCommunityBoards } from "@/lib/community-ensure-boards";

const LOG_PREFIX = "[trouble/from-note]";

/** 노트에서 난구해결(community/trouble) 게시글 생성. CommunityPost + TroubleShotPost 생성 후 postId 반환 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  console.log(LOG_PREFIX, "세션:", session ? { id: session.id, role: session.role } : null);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const writeEnabled = await isFeatureEnabled("community_write_enabled");
  if (!writeEnabled) {
    return NextResponse.json({ error: "현재 커뮤니티 글쓰기가 중단되었습니다." }, { status: 503 });
  }

  let body: { noteId: string; title: string; content: string; imageUrl?: string | null };
  try {
    body = await request.json();
  } catch (e) {
    console.error(LOG_PREFIX, "request.json() 실패:", e);
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const noteId = (body.noteId ?? "").trim();
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!noteId) return NextResponse.json({ error: "노트 ID가 필요합니다." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });

  try {
    const note = await prisma.billiardNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        authorId: true,
        imageUrl: true,
        redBallX: true,
        redBallY: true,
        yellowBallX: true,
        yellowBallY: true,
        whiteBallX: true,
        whiteBallY: true,
        cueBall: true,
      },
    });
    if (!note || note.authorId !== session.id) {
      console.log(LOG_PREFIX, "노트 조회 실패 또는 권한 없음:", { noteId, note: note ?? null, sessionId: session.id });
      return NextResponse.json({ error: "해당 노트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    let board = await prisma.communityBoard.findUnique({
      where: { slug: "trouble" },
      select: { id: true },
    });
    console.log(LOG_PREFIX, "게시판 조회(1차):", board ? "성공" : "없음", board ?? null);
    if (!board) {
      await ensureDefaultCommunityBoards();
      board = await prisma.communityBoard.findUnique({
        where: { slug: "trouble" },
        select: { id: true },
      });
      console.log(LOG_PREFIX, "게시판 조회(2차, ensure 후):", board ? "성공" : "없음", board ?? null);
    }
    if (!board) {
      return NextResponse.json({ error: "난구해결 게시판을 찾을 수 없습니다." }, { status: 404 });
    }

    const layoutImageUrl = (body.imageUrl ?? note.imageUrl)?.trim() || null;

    /** BilliardNote는 컬럼 저장 — TroubleShotPost·난구와 동일 NanguBallPlacement JSON */
    const ballPlacementJson = JSON.stringify({
      redBall: { x: note.redBallX, y: note.redBallY },
      yellowBall: { x: note.yellowBallX, y: note.yellowBallY },
      whiteBall: { x: note.whiteBallX, y: note.whiteBallY },
      cueBall: note.cueBall === "yellow" ? "yellow" : "white",
    });

    const postPayload = {
      boardId: board.id,
      authorId: session.id,
      title,
      content: content || " ",
    };
    const troublePayload = {
      postId: "(create 직후 채움)" as unknown as string,
      sourceNoteId: note.id,
      layoutImageUrl,
      difficulty: null,
    };
    console.log(LOG_PREFIX, "CommunityPost create 직전 payload:", JSON.stringify(postPayload, null, 2));
    console.log(LOG_PREFIX, "TroubleShotPost 예정 payload:", JSON.stringify({ ...troublePayload, postId: "(post.id)" }, null, 2));

    let post: { id: string };
    try {
      post = await prisma.communityPost.create({
        data: postPayload,
      });
    } catch (createErr) {
      const err = createErr as Error & { code?: string; meta?: unknown };
      console.error(LOG_PREFIX, "CommunityPost.create 실패:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        meta: err.meta,
        payload: postPayload,
      });
      throw createErr;
    }

    try {
      await prisma.troubleShotPost.create({
        data: {
          postId: post.id,
          sourceNoteId: note.id,
          layoutImageUrl,
          ballPlacementJson,
          difficulty: null,
        },
      });
    } catch (createErr) {
      const err = createErr as Error & { code?: string; meta?: unknown };
      console.error(LOG_PREFIX, "TroubleShotPost.create 실패:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        meta: err.meta,
        payload: {
          postId: post.id,
          sourceNoteId: note.id,
          layoutImageUrl,
          ballPlacementJson: "(from note)",
          difficulty: null,
        },
      });
      throw createErr;
    }

    return NextResponse.json({ id: post.id });
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    console.error(LOG_PREFIX, "catch:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      meta: err.meta,
      requestBody: { noteId: body?.noteId, title: body?.title?.slice(0, 50), contentLength: body?.content?.length, imageUrl: body?.imageUrl ? "(있음)" : null },
    });
    const msg = err.message || "등록에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
