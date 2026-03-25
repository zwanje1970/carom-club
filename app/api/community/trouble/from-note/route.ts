import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import {
  createTroublePostFromNote,
  ensureTroubleBoardId,
  findAuthorOwnedSourceNote,
  findExistingTroublePostIdFromNote,
  mapBallPlacementJson,
  mapTroubleFromNoteContent,
} from "@/lib/services/bridge/trouble-from-note-service";
import {
  parseTroubleFromNoteBody,
  validateTroubleFromNote,
} from "@/lib/services/bridge/trouble-from-note-validator";

const LOG_PREFIX = "[trouble/from-note]";

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") console.log(LOG_PREFIX, ...args);
}

/** 노트에서 난구해결(community/trouble) 게시글 생성. CommunityPost + TroubleShotPost 생성 후 postId 반환 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  devLog("세션:", session ? { id: session.id, role: session.role } : null);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const writeEnabled = await isFeatureEnabled("community_write_enabled");
  if (!writeEnabled) {
    return NextResponse.json({ error: "현재 커뮤니티 글쓰기가 중단되었습니다." }, { status: 503 });
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
    const note = await findAuthorOwnedSourceNote(noteId, session.id);
    if (!note) {
      devLog("노트 조회 실패 또는 권한 없음:", { noteId, note: note ?? null, sessionId: session.id });
      return NextResponse.json({ error: "해당 난구노트를 찾을 수 없거나 권한이 없습니다." }, { status: 404 });
    }

    if (!parsed.forceNew) {
      const existingPostId = await findExistingTroublePostIdFromNote(noteId);
      if (existingPostId) {
        return NextResponse.json({ id: existingPostId, reused: true });
      }
    }

    const { title, content } = mapTroubleFromNoteContent(note, parsed);

    const boardId = await ensureTroubleBoardId();
    if (!boardId) {
      return NextResponse.json({ error: "난구해결 게시판을 찾을 수 없습니다." }, { status: 404 });
    }

    const layoutImageUrl = (parsed.imageUrl ?? note.imageUrl)?.trim() || null;

    const ballPlacementJson = mapBallPlacementJson(note);

    const created = await createTroublePostFromNote({
      boardId,
      authorId: session.id,
      noteId: note.id,
      title,
      content,
      layoutImageUrl,
      ballPlacementJson,
    });

    return NextResponse.json({ id: created.id });
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    if (process.env.NODE_ENV === "development") {
      console.error(LOG_PREFIX, "catch:", {
        message: err.message,
        stack: err.stack,
        code: err.code,
        meta: err.meta,
        requestBody:
          parsed
            ? {
                noteId: parsed.noteId,
                title: parsed.title?.slice(0, 50),
                contentLength: parsed.content?.length,
                imageUrl: parsed.imageUrl ? "(있음)" : null,
              }
            : null,
      });
    } else {
      console.error(LOG_PREFIX, err.message);
    }
    const msg = err.message || "등록에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
