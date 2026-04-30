import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getUserById,
  isAutoParticipantPushEnabledForClientUserId,
  type TournamentApplicationStatus,
} from "../../../../../../../../lib/platform-api";
import {
  getTournamentApplicationByIdFirestore,
  updateTournamentApplicationStatusFirestore,
} from "../../../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../../../lib/server/firestore-tournaments";
import {
  clampAutoPushBody,
  truncateTournamentNameForAutoPush,
} from "../../../../../../../../lib/server/tournament-auto-push-text";

export const runtime = "nodejs";

function internalOriginFromRequest(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const protoPart = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0];
  const proto = (protoPart ?? "http").trim();
  if (host) return `${proto}://${host.trim()}`;
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (envBase) return envBase;
  return "http://127.0.0.1:3000";
}

async function fireAutoApprovePush(req: NextRequest, params: { applicantUserId: string; tournamentTitle: string }) {
  const uid = params.applicantUserId.trim();
  if (!uid) return;
  const display = truncateTournamentNameForAutoPush(params.tournamentTitle);
  const bodyText = clampAutoPushBody(`${display} 참가가 확정되었습니다.`, 60);
  const url = `${internalOriginFromRequest(req)}/api/push/send`;
  const cookie = req.headers.get("cookie") ?? "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({
        title: "참가 승인 완료",
        body: bodyText,
        targetUserIds: [uid],
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[auto-push/approve] push/send failed", res.status, j.error ?? "");
    }
  } catch (e) {
    console.error("[auto-push/approve]", e);
  }
}

const ALLOWED_STATUSES: TournamentApplicationStatus[] = [
  "APPLIED",
  "VERIFYING",
  "WAITING_PAYMENT",
  "APPROVED",
  "REJECTED",
];

function isTournamentApplicationStatus(value: unknown): value is TournamentApplicationStatus {
  return typeof value === "string" && ALLOWED_STATUSES.includes(value as TournamentApplicationStatus);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; entryId: string }> }
) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id, entryId } = await context.params;
  if (!id.trim() || !entryId.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const targetEntry = await getTournamentApplicationByIdFirestore(id, entryId);
  if (!targetEntry) {
    return NextResponse.json({ error: "참가신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const isPlatform = user.role === "PLATFORM";
  let canManage = false;
  if (isPlatform) {
    canManage = true;
  } else if (user.role === "CLIENT" && tournament.createdBy === user.id) {
    const clientStatus = await getClientStatusByUserId(user.id);
    canManage = clientStatus === "APPROVED";
  }

  if (!canManage) {
    return NextResponse.json({ error: "상태 변경 권한이 없습니다." }, { status: 403 });
  }

  let body: { nextStatus?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (!isTournamentApplicationStatus(body.nextStatus)) {
    return NextResponse.json({ error: "nextStatus 값이 올바르지 않습니다." }, { status: 400 });
  }

  const result = await updateTournamentApplicationStatusFirestore({
    tournamentId: id,
    entryId,
    nextStatus: body.nextStatus,
    actorUserId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (body.nextStatus === "APPROVED" && targetEntry.status !== "APPROVED") {
    const applicantUserId = String(result.application.userId ?? "").trim();
    const creatorId = String(tournament.createdBy ?? "").trim();
    if (applicantUserId && creatorId && (await isAutoParticipantPushEnabledForClientUserId(creatorId))) {
      void fireAutoApprovePush(request, { applicantUserId, tournamentTitle: tournament.title });
    }
  }

  return NextResponse.json({ ok: true, application: result.application });
}
