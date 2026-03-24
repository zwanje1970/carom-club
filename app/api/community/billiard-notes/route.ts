import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizeCueBallType } from "@/lib/billiard-table-constants";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { SessionUser } from "@/types/auth";

function logBilliardNotesAuthDebug(request: Request, session: SessionUser | null) {
  if (process.env.AUTH_DEBUG_COOKIE !== "1") return;
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "";
  const ck = request.headers.get("cookie") ?? "";
  let mineParam: string | null = null;
  let visibilityParam: string | null = null;
  try {
    const u = new URL(request.url);
    mineParam = u.searchParams.get("mine");
    visibilityParam = u.searchParams.get("visibility");
  } catch {
    // ignore
  }
  console.warn("[billiard-notes] AUTH_DEBUG_COOKIE", {
    host,
    xForwardedProto: proto,
    cookieHeaderPresent: ck.length > 0,
    cookieLength: ck.length,
    hasCaromSessionName: ck.includes("carom_session"),
    getSessionOk: session != null,
    mineParam,
    visibilityParam,
  });
}

/** 내 노트 목록: GET ?mine=1 (기본). 커뮤니티 피드: GET ?visibility=community */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  logBilliardNotesAuthDebug(request, session);
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") !== "0";
  const visibility = searchParams.get("visibility");

  if (visibility === "community") {
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const list = await prisma.billiardNote.findMany({
      where: { visibility: "community" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        memo: true,
        imageUrl: true,
        visibility: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(
      list.map((n) => ({
        id: n.id,
        memo: n.memo,
        imageUrl: n.imageUrl,
        visibility: n.visibility,
        createdAt: n.createdAt.toISOString(),
        authorName: n.author.name,
      }))
    );
  }

  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const list = await prisma.billiardNote.findMany({
    where: mine ? { authorId: session.id } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      memo: true,
      imageUrl: true,
      visibility: true,
      createdAt: true,
      _count: { select: { troubleShotsFromNote: true } },
    },
  });
  return NextResponse.json(
    list.map((n) => ({
      id: n.id,
      title: n.title,
      memo: n.memo,
      imageUrl: n.imageUrl,
      visibility: n.visibility,
      createdAt: n.createdAt.toISOString(),
      sentToTroubleCount: n._count.troubleShotsFromNote,
    }))
  );
}

/** 노트 생성. 이미지 URL은 먼저 upload-image로 업로드 후 전달. */
export async function POST(request: Request) {
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

  const redBall = body.redBall;
  const yellowBall = body.yellowBall;
  const whiteBall = body.whiteBall;
  if (
    !redBall || typeof redBall.x !== "number" || typeof redBall.y !== "number" ||
    !yellowBall || typeof yellowBall.x !== "number" || typeof yellowBall.y !== "number" ||
    !whiteBall || typeof whiteBall.x !== "number" || typeof whiteBall.y !== "number"
  ) {
    return NextResponse.json(
      { error: "공 배치 정보(redBall, yellowBall, whiteBall)가 필요합니다." },
      { status: 400 }
    );
  }

  const visibility = body.visibility === "community" ? "community" : "private";
  const cueBall = normalizeCueBallType(body.cueBall);
  const noteDate = body.noteDate ? new Date(body.noteDate) : null;

  try {
    const note = await prisma.billiardNote.create({
      data: {
        authorId: session.id,
        title: body.title?.trim() || null,
        noteDate,
        redBallX: redBall.x,
        redBallY: redBall.y,
        yellowBallX: yellowBall.x,
        yellowBallY: yellowBall.y,
        whiteBallX: whiteBall.x,
        whiteBallY: whiteBall.y,
        cueBall,
        memo: body.memo?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        visibility,
      },
    });
    return NextResponse.json({
    id: note.id,
    visibility: note.visibility,
    createdAt: note.createdAt.toISOString(),
  });
  } catch (e) {
    console.error("[billiard-notes] POST create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
