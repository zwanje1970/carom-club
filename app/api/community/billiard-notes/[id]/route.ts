import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizeCueBallType } from "@/lib/billiard-table-constants";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

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

  const note = await prisma.billiardNote.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      noteDate: true,
      redBallX: true,
      redBallY: true,
      yellowBallX: true,
      yellowBallY: true,
      whiteBallX: true,
      whiteBallY: true,
      cueBall: true,
      memo: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true } },
    },
  });
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

  const existing = await prisma.billiardNote.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "난구노트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.authorId !== session.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  let body: {
    title?: string | null;
    noteDate?: string | null;
    redBall?: { x: number; y: number };
    yellowBall?: { x: number; y: number };
    whiteBall?: { x: number; y: number };
    cueBall?: string;
    memo?: string | null;
    imageUrl?: string | null;
    visibility?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title?.trim() || null;
  if (body.noteDate !== undefined) data.noteDate = body.noteDate ? new Date(body.noteDate) : null;
  if (body.redBall != null) {
    data.redBallX = body.redBall.x;
    data.redBallY = body.redBall.y;
  }
  if (body.yellowBall != null) {
    data.yellowBallX = body.yellowBall.x;
    data.yellowBallY = body.yellowBall.y;
  }
  if (body.whiteBall != null) {
    data.whiteBallX = body.whiteBall.x;
    data.whiteBallY = body.whiteBall.y;
  }
  if (body.cueBall != null) {
    data.cueBall = normalizeCueBallType(body.cueBall);
  }
  if (body.memo !== undefined) data.memo = body.memo?.trim() || null;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
  if (body.visibility != null) {
    data.visibility = body.visibility === "community" ? "community" : "private";
  }

  const updated = await prisma.billiardNote.update({
    where: { id },
    data,
  });
  return NextResponse.json({
    id: updated.id,
    visibility: updated.visibility,
    updatedAt: updated.updatedAt.toISOString(),
  });
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

  const existing = await prisma.billiardNote.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "난구노트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.authorId !== session.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.billiardNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
