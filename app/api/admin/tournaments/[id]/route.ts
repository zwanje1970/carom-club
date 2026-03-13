import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

/** 이전 대회 복사용: 대회 + 규칙 전체 반환 (원본과 연결 없음). */
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
  if (session.role !== "PLATFORM_ADMIN" && session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
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
  if (!isPlatformAdmin(session) && tournament.organization.ownerUserId !== session.id) {
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
    organization: tournament.organization,
  });
}

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
  if (session.role !== "PLATFORM_ADMIN" && session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!isPlatformAdmin(session) && tournament.organization.ownerUserId !== session.id) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    startAt,
    venue,
    venueName,
    status,
    gameFormat,
    entryFee,
    maxParticipants,
    entryCondition,
    prizeInfo,
    rules,
    promoContent,
  } = body as {
    name?: string;
    startAt?: string;
    venue?: string;
    venueName?: string;
    status?: string;
    gameFormat?: string;
    entryFee?: number | null;
    maxParticipants?: number | null;
    entryCondition?: string | null;
    prizeInfo?: string | null;
    rules?: string | null;
    promoContent?: string | null;
  };

  const validStatuses = ["DRAFT", "OPEN", "CLOSED", "FINISHED", "HIDDEN"] as const;
  const statusValue =
    status !== undefined && validStatuses.includes(status as (typeof validStatuses)[number])
      ? (status as (typeof validStatuses)[number])
      : undefined;

  try {
    await prisma.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startAt !== undefined && { startAt: new Date(startAt) }),
        ...(venue !== undefined && { venue: venue || null }),
        ...(venueName !== undefined && { venueName: venueName || null }),
        ...(statusValue !== undefined && { status: statusValue }),
        ...(gameFormat !== undefined && { gameFormat: gameFormat || null }),
        ...(entryFee !== undefined && { entryFee: entryFee != null && Number.isFinite(Number(entryFee)) ? Number(entryFee) : null }),
        ...(maxParticipants !== undefined && { maxParticipants: maxParticipants != null && Number.isFinite(Number(maxParticipants)) ? Number(maxParticipants) : null }),
        ...(entryCondition !== undefined && { entryCondition: entryCondition?.trim() || null }),
        ...(prizeInfo !== undefined && { prizeInfo: prizeInfo?.trim() || null }),
        ...(rules !== undefined && { rules: rules?.trim() || null }),
        ...(promoContent !== undefined && { promoContent: promoContent?.trim() || null }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("tournament update error", e);
    return NextResponse.json(
      { error: "대회 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
