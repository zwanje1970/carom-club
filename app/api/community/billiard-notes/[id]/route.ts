import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  deleteBilliardNote,
  getBilliardNoteAuthor,
  getBilliardNoteDetail,
  updateBilliardNote,
} from "@/lib/services/note/billiard-note-service";
import { parseBilliardNoteWriteBody } from "@/lib/services/note/billiard-note-validator";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const note = await getBilliardNoteDetail(id);
  if (!note) {
    return NextResponse.json({ error: "난구노트를 찾을 수 없습니다." }, { status: 404 });
  }
  const isAuthor = session?.id === note.authorId;
  if (note.visibility !== "community" && !isAuthor) {
    return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    id: note.id,
    authorId: note.authorId,
    authorName: note.author.name,
    title: note.title,
    noteDate: note.noteDate?.toISOString() ?? null,
    redBall: { x: note.redBallX, y: note.redBallY },
    yellowBall: { x: note.yellowBallX, y: note.yellowBallY },
    whiteBall: { x: note.whiteBallX, y: note.whiteBallY },
    cueBall: note.cueBall,
    memo: note.memo,
    imageUrl: note.imageUrl,
    visibility: note.visibility,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    isAuthor,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = parseBilliardNoteWriteBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const existing = await getBilliardNoteAuthor(id);
  if (!existing) {
    return NextResponse.json({ error: "난구노트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.authorId !== session.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const updated = await updateBilliardNote(id, parsed);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await getBilliardNoteAuthor(id);
  if (!existing) {
    return NextResponse.json({ error: "난구노트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.authorId !== session.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const deleted = await deleteBilliardNote(id);
  return NextResponse.json(deleted);
}
