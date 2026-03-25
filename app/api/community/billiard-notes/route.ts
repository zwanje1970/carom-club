import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { SessionUser } from "@/types/auth";
import {
  createBilliardNote,
  listCommunityNotes,
  listMineOrAllNotes,
} from "@/lib/services/note/billiard-note-service";
import {
  parseBilliardNoteWriteBody,
  validateBallPlacementForCreate,
} from "@/lib/services/note/billiard-note-validator";

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
    const list = await listCommunityNotes();
    return NextResponse.json(list);
  }

  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const list = await listMineOrAllNotes({
    mine,
    visibility,
    sessionUserId: session.id,
  });
  return NextResponse.json(list);
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
  const valid = validateBallPlacementForCreate(parsed);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  try {
    const created = await createBilliardNote(session.id, parsed, {
      redBall: valid.redBall,
      yellowBall: valid.yellowBall,
      whiteBall: valid.whiteBall,
    });
    return NextResponse.json(created);
  } catch (e) {
    console.error("[billiard-notes] POST create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
