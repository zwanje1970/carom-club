import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import {
  parseTroubleFromNoteBody,
  validateTroubleFromNote,
} from "@/lib/services/bridge/trouble-from-note-validator";
import {
  findAuthorOwnedSourceNote,
} from "@/lib/services/bridge/trouble-from-note-service";

const LOG_PREFIX = "[nangu/from-note]";

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") console.log(LOG_PREFIX, ...args);
}

/** 난구노트에서 난구해결사(NanguPost) 게시글 생성 후 post id 반환 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { isFeatureEnabled } = await import("@/lib/site-feature-flags");
  const writeEnabled = await isFeatureEnabled("community_write_enabled");
  if (!writeEnabled) {
    return NextResponse.json({ error: "현재 커뮤니티 글쓰기가 중단되었습니다." }, { status: 503 });
  }

  const canSendNoteToSolver = await hasPermission(
    session,
    PERMISSION_KEYS.NOTE_SEND_TO_SOLVER
  );
  if (!canSendNoteToSolver) {
    return NextResponse.json(
      { error: "난구노트를 난구해결사로 전송할 권한이 없습니다." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (e) {
    console.error(LOG_PREFIX, "request.json() 실패:", e);
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = parseTroubleFromNoteBody(body);
  if (!parsed) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const valid = validateTroubleFromNote(parsed);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const noteId = valid.noteId;

  try {
    const {
      createNanguPostFromNote,
      findExistingNanguPostIdFromNote,
      mapBallPlacementJson,
      mapNoteToNanguContent,
    } = await import("@/lib/services/bridge/nangu-from-note-service");

    const note = await findAuthorOwnedSourceNote(noteId, session.id);
    if (!note) {
      devLog("노트 조회 실패 또는 권한 없음:", { noteId, sessionId: session.id });
      return NextResponse.json({ error: "해당 난구노트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    if (!parsed.forceNew) {
      const existingId = await findExistingNanguPostIdFromNote(noteId);
      if (existingId) {
        return NextResponse.json({ id: existingId, reused: true });
      }
    }

    const { title, content } = mapNoteToNanguContent(note, parsed);
    const ballPlacementJson = mapBallPlacementJson(note);

    const created = await createNanguPostFromNote({
      authorId: session.id,
      noteId: note.id,
      title,
      content,
      ballPlacementJson,
    });

    try {
      const { grantUserPoints } = await import("@/lib/activity-point-service");
      await grantUserPoints(session.id, "NOTE_SEND_TO_SOLVER", undefined, {
        refType: "note_to_solver",
        refId: created.id,
        description: "노트에서 난구해결사 전송",
        idempotencyKey: `note_send_to_solver_nangu:${note.id}:${created.id}`,
      });
    } catch (_) {}

    return NextResponse.json({ id: created.id });
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    if (process.env.NODE_ENV === "development") {
      console.error(LOG_PREFIX, "catch:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        meta: err.meta,
      });
    } else {
      console.error(LOG_PREFIX, err.message);
    }
    const msg = err.message || "등록에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
