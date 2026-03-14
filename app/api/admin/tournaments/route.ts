import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";
import { getPlatformSettings, hasActiveClientMembership } from "@/lib/platform-settings";

/** 최근 대회 목록 (이전 대회 불러오기 모달용). ?organizationId= 시 해당 업체만. */
export async function GET(request: Request) {
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
  if (session.role !== "PLATFORM_ADMIN" && session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let organizationId: string | undefined = searchParams.get("organizationId") ?? undefined;
  if (!isPlatformAdmin(session)) {
    const myOrgId = await getClientAdminOrganizationId(session);
    if (myOrgId) organizationId = myOrgId;
  }
  const take = Math.min(Number(searchParams.get("take")) || 20, 50);

  try {
    const list = await prisma.tournament.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { startAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        startAt: true,
        organizationId: true,
        venue: true,
        status: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    return NextResponse.json(
      list.map((t) => ({
        id: t.id,
        name: t.name,
        startAt: t.startAt,
        organizationId: t.organizationId,
        venue: t.venue,
        status: t.status,
        organization: t.organization,
      }))
    );
  } catch (e) {
    console.error("tournaments list error", e);
    return NextResponse.json({ error: "목록 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const body = await request.json();
  const {
    organizationId: bodyOrgId,
    name,
    startAt,
    endAt,
    venue,
    venueName,
    region,
    status,
    gameFormat,
    title,
    slug,
    summary,
    description,
    posterImageUrl,
    imageUrl,
    entryFee,
    maxParticipants,
    entryCondition,
    qualification,
    prizeInfo,
    rules,
    promoContent,
    outlineDraft,
    outlinePublished,
    approvalType,
    rule,
  } = body as {
    organizationId?: string;
    name?: string;
    startAt?: string;
    endAt?: string | null;
    venue?: string | null;
    venueName?: string | null;
    region?: string | null;
    status?: string;
    gameFormat?: string | null;
    title?: string | null;
    slug?: string | null;
    summary?: string | null;
    description?: string | null;
    posterImageUrl?: string | null;
    imageUrl?: string | null;
    entryFee?: number | null;
    maxParticipants?: number | null;
    entryCondition?: string | null;
    qualification?: string | null;
    prizeInfo?: string | null;
    rules?: string | null;
    promoContent?: string | null;
    outlineDraft?: string | null;
    outlinePublished?: string | null;
    approvalType?: string | null;
    rule?: {
      entryFee?: number | null;
      operatingFee?: number | null;
      maxEntries?: number | null;
      useWaiting?: boolean;
      entryConditions?: string | null;
      bracketType?: string | null;
      bracketConfig?: Record<string, unknown> | string | null;
      prizeType?: string | null;
      prizeInfo?: string | null;
    };
  };

  let organizationId: string;
  if (isPlatformAdmin(session)) {
    if (!bodyOrgId || !name?.trim() || !startAt) {
      return NextResponse.json(
        { error: "업체, 대회명, 일시를 입력해주세요." },
        { status: 400 }
      );
    }
    organizationId = bodyOrgId;
  } else {
    const myOrgId = await getClientAdminOrganizationId(session);
    if (!myOrgId) {
      return NextResponse.json(
        { error: "소속된 업체가 없습니다. 먼저 업체 설정을 완료해 주세요." },
        { status: 403 }
      );
    }
    organizationId = myOrgId;
    if (!name?.trim() || !startAt) {
      return NextResponse.json(
        { error: "대회명, 일시를 입력해주세요." },
        { status: 400 }
      );
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, type: true },
  });
  if (!org) {
    return NextResponse.json(
      { error: "업체를 찾을 수 없습니다." },
      { status: 400 }
    );
  }
  if (org.type === "INSTRUCTOR") {
    return NextResponse.json(
      { error: "레슨 클라이언트는 대회 등록이 불가합니다." },
      { status: 403 }
    );
  }

  const platform = await getPlatformSettings();
  if (platform.billingEnabled) {
    const hasMembership = await hasActiveClientMembership(organizationId);
    if (!hasMembership) {
      return NextResponse.json(
        {
          error: "대회 1회 이용권 결제가 필요합니다.",
          requiredPayment: {
            type: "tournament_fee",
            amount: platform.tournamentFee,
          },
        },
        { status: 402 }
      );
    }
  }

  const validStatus =
    typeof status === "string" && ["DRAFT", "OPEN", "CLOSED", "FINISHED", "HIDDEN"].includes(status)
      ? status
      : "OPEN";
  try {
    const tournament = await prisma.tournament.create({
      data: {
        organizationId,
        name: name.trim(),
        startAt: new Date(startAt),
        ...(endAt != null && endAt !== "" && { endAt: new Date(endAt) }),
        venue: venue != null ? (venue as string).trim() || null : null,
        venueName: venueName != null ? (venueName as string).trim() || null : null,
        region: region != null ? (region as string).trim() || null : null,
        status: validStatus as "DRAFT" | "OPEN" | "CLOSED" | "FINISHED" | "HIDDEN",
        gameFormat: gameFormat != null ? (gameFormat as string).trim() || null : null,
        title: title != null ? (title as string).trim() || null : null,
        slug: slug != null ? (slug as string).trim() || null : null,
        summary: summary != null ? (summary as string).trim() || null : null,
        description: description != null ? (description as string).trim() || null : null,
        posterImageUrl: posterImageUrl != null ? (posterImageUrl as string).trim() || null : null,
        imageUrl: imageUrl != null ? (imageUrl as string).trim() || null : null,
        entryFee: entryFee != null && Number.isFinite(Number(entryFee)) ? Number(entryFee) : null,
        maxParticipants: maxParticipants != null && Number.isFinite(Number(maxParticipants)) ? Number(maxParticipants) : null,
        entryCondition: entryCondition != null ? (entryCondition as string).trim() || null : null,
        qualification: qualification != null ? (qualification as string).trim() || null : null,
        prizeInfo: prizeInfo != null ? (prizeInfo as string).trim() || null : null,
        rules: rules != null ? (rules as string).trim() || null : null,
        promoContent: promoContent != null ? (promoContent as string).trim() || null : null,
        outlineDraft: outlineDraft != null ? (outlineDraft as string).trim() || null : null,
        outlinePublished: outlinePublished != null ? (outlinePublished as string).trim() || null : null,
        approvalType: approvalType != null ? (approvalType as string).trim() || undefined : undefined,
      },
    });
    if (rule && typeof rule === "object") {
      const bracketConfigStr =
        rule.bracketConfig !== undefined && rule.bracketConfig !== null
          ? typeof rule.bracketConfig === "string"
            ? rule.bracketConfig
            : JSON.stringify(rule.bracketConfig)
          : undefined;
      await prisma.tournamentRule.upsert({
        where: { tournamentId: tournament.id },
        create: {
          tournamentId: tournament.id,
          entryFee: rule.entryFee ?? undefined,
          operatingFee: rule.operatingFee ?? undefined,
          maxEntries: rule.maxEntries ?? undefined,
          useWaiting: rule.useWaiting ?? false,
          entryConditions: rule.entryConditions ?? undefined,
          bracketType: rule.bracketType ?? undefined,
          bracketConfig: bracketConfigStr ?? undefined,
          prizeType: rule.prizeType ?? undefined,
          prizeInfo: rule.prizeInfo ?? undefined,
        },
        update: {
          entryFee: rule.entryFee ?? undefined,
          operatingFee: rule.operatingFee ?? undefined,
          maxEntries: rule.maxEntries ?? undefined,
          useWaiting: rule.useWaiting ?? false,
          entryConditions: rule.entryConditions ?? undefined,
          bracketType: rule.bracketType ?? undefined,
          bracketConfig: bracketConfigStr ?? undefined,
          prizeType: rule.prizeType ?? undefined,
          prizeInfo: rule.prizeInfo ?? undefined,
        },
      });
    }
    return NextResponse.json({ ok: true, id: tournament.id });
  } catch (e) {
    console.error("tournament create error", e);
    return NextResponse.json(
      { error: "대회 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
