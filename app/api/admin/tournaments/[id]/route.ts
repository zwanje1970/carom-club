import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { normalizeSlug } from "@/lib/normalize-slug";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { sendPrizeNotifications } from "@/lib/push/prizeNotifications";

/** 이전 대회 복사용: 대회 + 규칙 전체 반환 (원본과 연결 없음). GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, slug: true, ownerUserId: true } },
      rule: true,
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 볼 권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      organizationId: tournament.organizationId,
      name: tournament.name,
      title: tournament.title,
      slug: tournament.slug,
      summary: tournament.summary,
      description: tournament.description,
      posterImageUrl: tournament.posterImageUrl,
      imageUrl: tournament.imageUrl,
      venue: tournament.venue,
      venueName: tournament.venueName,
      region: tournament.region,
      startAt: tournament.startAt,
      endAt: tournament.endAt,
      entryFee: tournament.entryFee,
      prizeInfo: tournament.prizeInfo,
      gameFormat: tournament.gameFormat,
      qualification: tournament.qualification,
      entryCondition: tournament.entryCondition,
      maxParticipants: tournament.maxParticipants,
      status: tournament.status,
      approvalType: tournament.approvalType,
      rules: tournament.rules,
      promoContent: tournament.promoContent,
      outlineDraft: tournament.outlineDraft,
      outlinePublished: tournament.outlinePublished,
    },
    rule: tournament.rule
      ? {
          entryFee: tournament.rule.entryFee,
          operatingFee: tournament.rule.operatingFee,
          maxEntries: tournament.rule.maxEntries,
          useWaiting: tournament.rule.useWaiting,
          entryConditions: tournament.rule.entryConditions,
          bracketType: tournament.rule.bracketType,
          bracketConfig: tournament.rule.bracketConfig,
          prizeType: tournament.rule.prizeType,
          prizeInfo: tournament.rule.prizeInfo,
        }
      : null,
    organization: tournament.organization ? normalizeSlug(tournament.organization) : null,
  });
}

/** 대회 수정. PATCH → canManageTournament (클라이언트: 자기 대회, 플랫폼: 전체) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
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
        ...(entryFee !== undefined && { entryFee: entryFee != null && Number.isFinite(Number(entryFee)) ? Number(entryFee) : null }),
        ...(maxParticipants !== undefined && { maxParticipants: maxParticipants != null && Number.isFinite(Number(maxParticipants)) ? Number(maxParticipants) : null }),
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
    const err = e as { code?: string; meta?: { target?: string[]; column_name?: string }; message?: string };
    console.error("tournament update error (raw):", e);
    console.error("tournament update error (JSON):", JSON.stringify(e, null, 2));
    if (err?.code) console.error("Prisma error code:", err.code);
    if (err?.meta) console.error("Prisma error meta:", JSON.stringify(err.meta, null, 2));
    const missingColumn = err?.meta?.column_name ?? (err?.meta as { column?: string })?.column ?? (err?.meta as { target?: string[] })?.target?.[0];
    if (missingColumn) console.error("에러에 포함된 컬럼명(없는 컬럼 가능성):", missingColumn);
    return NextResponse.json(
      {
        error: "대회 수정 중 오류가 발생했습니다.",
        ...(process.env.NODE_ENV === "development" && err?.message && { detail: err.message }),
        ...(missingColumn && { missingColumn: String(missingColumn) }),
      },
      { status: 500 }
    );
  }
}
