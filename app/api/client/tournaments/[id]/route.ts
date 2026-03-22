import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { sendPrizeNotifications } from "@/lib/push/prizeNotifications";
import { canAccessClientDashboard } from "@/types/auth";

/** GET: 클라이언트 로그인 모드일 때만 본인 소유 업체의 대회 1건 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    include: {
      matchVenues: { orderBy: { sortOrder: "asc" } },
      rule: true,
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(tournament);
}

/** PATCH: 클라 콘솔 전용 대회 기본 필드 수정 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id } = await params;
  const gate = await assertClientCanMutateTournamentById(session, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json();
  const {
    name,
    startAt,
    endAt,
    venue,
    venueName,
    status,
    gameFormat,
    summary,
    description,
    posterImageUrl,
    entryFee,
    maxParticipants,
    entryCondition,
    prizeInfo,
    rules,
    promoContent,
  } = body as {
    name?: string;
    startAt?: string;
    endAt?: string | null;
    venue?: string;
    venueName?: string;
    status?: string;
    gameFormat?: string;
    summary?: string | null;
    description?: string | null;
    posterImageUrl?: string | null;
    entryFee?: number | null;
    maxParticipants?: number | null;
    entryCondition?: string | null;
    prizeInfo?: string | null;
    rules?: string | null;
    promoContent?: string | null;
  };

  const validStatuses = ["DRAFT", "OPEN", "CLOSED", "BRACKET_GENERATED", "FINISHED", "HIDDEN"] as const;
  const statusValue =
    status !== undefined && validStatuses.includes(status as (typeof validStatuses)[number])
      ? (status as (typeof validStatuses)[number])
      : undefined;
  const wasFinished = tournament.status === "FINISHED";
  const becomingFinished = statusValue === "FINISHED" && !wasFinished;

  const rosterLocked = tournament.participantRosterLockedAt != null;
  if (rosterLocked) {
    if (maxParticipants !== undefined || entryFee !== undefined) {
      return NextResponse.json(
        { error: "참가 명단이 확정된 대회는 정원·참가비를 수정할 수 없습니다." },
        { status: 409 }
      );
    }
    if (statusValue !== undefined && (statusValue === "OPEN" || statusValue === "DRAFT")) {
      return NextResponse.json(
        { error: "참가 명단 확정 후 모집 중·초안 상태로 되돌릴 수 없습니다." },
        { status: 409 }
      );
    }
  }

  try {
    await prisma.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startAt !== undefined && { startAt: new Date(startAt) }),
        ...(endAt !== undefined && { endAt: endAt != null && endAt !== "" ? new Date(endAt) : null }),
        ...(venue !== undefined && { venue: venue || null }),
        ...(venueName !== undefined && { venueName: venueName || null }),
        ...(statusValue !== undefined && { status: statusValue }),
        ...(gameFormat !== undefined && { gameFormat: gameFormat || null }),
        ...(summary !== undefined && { summary: summary?.trim() || null }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(posterImageUrl !== undefined && { posterImageUrl: posterImageUrl?.trim() || null }),
        ...(entryFee !== undefined && {
          entryFee: entryFee != null && Number.isFinite(Number(entryFee)) ? Number(entryFee) : null,
        }),
        ...(maxParticipants !== undefined && {
          maxParticipants:
            maxParticipants != null && Number.isFinite(Number(maxParticipants)) ? Number(maxParticipants) : null,
        }),
        ...(entryCondition !== undefined && { entryCondition: entryCondition?.trim() || null }),
        ...(prizeInfo !== undefined && { prizeInfo: prizeInfo?.trim() || null }),
        ...(rules !== undefined && { rules: rules?.trim() || null }),
        ...(promoContent !== undefined && { promoContent: promoContent?.trim() || null }),
      },
    });
    if (becomingFinished) {
      try {
        const t = await prisma.tournament.findUnique({ where: { id }, select: { name: true } });
        if (t) await sendPrizeNotifications(id, t.name);
      } catch (pushErr) {
        console.error("prize push error", pushErr);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[client/tournaments PATCH]", e);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

