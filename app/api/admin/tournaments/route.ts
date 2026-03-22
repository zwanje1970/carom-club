import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_PUBLIC, TOURNAMENT_SELECT_LIST } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { normalizeSlug } from "@/lib/normalize-slug";
import { isPlatformAdmin, isClientAdmin, canManageOrganization } from "@/lib/permissions";
import { getPlatformSettings, hasActiveClientMembership } from "@/lib/platform-settings";
import {
  buildTournamentCreateData,
  insertTournamentWithRuleAndListing,
  type TournamentCreateFields,
} from "@/lib/tournament-create-shared";

/** 최근 대회 목록 (이전 대회 불러오기 모달용). ?organizationId= 시 해당 업체만. GET → 조회 권한만. */
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
  if (!isPlatformAdmin(session) && !isClientAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId: string | undefined = !isPlatformAdmin(session)
    ? (await getClientAdminOrganizationId(session)) ?? searchParams.get("organizationId") ?? undefined
    : searchParams.get("organizationId") ?? undefined;
  const take = Math.min(Number(searchParams.get("take")) || 20, 50);

  try {
    const list = await prisma.tournament.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { startAt: "desc" },
      take,
      select: {
        ...TOURNAMENT_SELECT_LIST,
        organization: { select: ORGANIZATION_SELECT_PUBLIC },
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
        organization:
          t.organization != null
            ? normalizeSlug(t.organization as unknown as { id: string; name: string; slug: string | null })
            : null,
      }))
    );
  } catch (e) {
    console.error("tournaments list error", e);
    return NextResponse.json({ error: "목록 조회에 실패했습니다." }, { status: 500 });
  }
}

/** 대회 생성. POST → 실무 권한(canManageOrganization). PLATFORM_ADMIN은 대회 생성 불가. */
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

  const body = await request.json();
  const {
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

  if (isPlatformAdmin(session)) {
    return NextResponse.json(
      { error: "대회 생성은 클라이언트 관리자만 가능합니다. 플랫폼 관리자는 대회 실무 권한이 없습니다." },
      { status: 403 }
    );
  }
  const myOrgId = await getClientAdminOrganizationId(session);
  if (!myOrgId) {
    return NextResponse.json(
      { error: "소속된 업체가 없습니다. 먼저 업체 설정을 완료해 주세요." },
      { status: 403 }
    );
  }
  const organizationId = myOrgId;
  if (!name?.trim() || !startAt) {
    return NextResponse.json(
      { error: "대회명, 일시를 입력해주세요." },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, type: true, ownerUserId: true },
  });
  if (!org) {
    return NextResponse.json(
      { error: "업체를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  if (!canManageOrganization(session, org)) {
    return NextResponse.json(
      { error: "해당 업체의 대회를 생성할 권한이 없습니다." },
      { status: 403 }
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

  const fields: TournamentCreateFields = {
    name: name!.trim(),
    startAt: startAt as string,
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
    rule: rule && typeof rule === "object" ? rule : null,
  };
  const createData = buildTournamentCreateData(organizationId, session.id, fields);

  try {
    const { id } = await insertTournamentWithRuleAndListing(createData, fields.rule);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const err = e as { code?: string; meta?: Record<string, unknown>; message?: string };
    console.error("tournament create error (raw):", e);
    console.error("tournament create error (JSON):", JSON.stringify(e, null, 2));
    if (err?.code) console.error("Prisma error code:", err.code);
    if (err?.meta) {
      console.error("Prisma error meta (전체):", JSON.stringify(err.meta, null, 2));
      const meta = err.meta as Record<string, unknown>;
      if (meta?.column_name != null) console.error("에러 로그에 없는 컬럼명(DB에 없음):", meta.column_name);
      if (meta?.column != null) console.error("에러 로그에 없는 컬럼명(DB에 없음):", meta.column);
      if (Array.isArray(meta?.target) && meta.target.length) console.error("에러 target(없는 컬럼 가능성):", meta.target);
    }
    const missingColumn =
      (err?.meta as { column_name?: string })?.column_name ??
      (err?.meta as { column?: string })?.column ??
      (Array.isArray((err?.meta as { target?: string[] })?.target) ? (err?.meta as { target: string[] }).target[0] : undefined);
    if (missingColumn) console.error("에러에 포함된 컬럼명(없는 컬럼 가능성):", missingColumn);
    return NextResponse.json(
      {
        error: "대회 생성 중 오류가 발생했습니다.",
        ...(process.env.NODE_ENV === "development" && err?.message && { detail: err.message }),
        ...(missingColumn && { missingColumn: String(missingColumn) }),
      },
      { status: 500 }
    );
  }
}
