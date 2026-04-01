import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientActiveOrgCanMutateTournaments } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getPlatformSettings, hasActiveClientMembership } from "@/lib/platform-settings";
import {
  buildTournamentCreateData,
  insertTournamentWithRuleAndListing,
  type TournamentCreateFields,
} from "@/lib/tournament-create-shared";
import { normalizeTournamentVerificationInput } from "@/lib/tournament-certification";

/**
 * 클라이언트 운영 콘솔 전용 대회 생성.
 * 활성 조직 + OWNER/ADMIN 멤버(또는 소유자)만 허용.
 */
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
  const gate = await assertClientActiveOrgCanMutateTournaments(session);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const org = await prisma.organization.findUnique({
    where: { id: gate.organizationId },
    select: { id: true, type: true },
  });
  if (!org) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  if (org.type === "INSTRUCTOR") {
    return NextResponse.json({ error: "레슨 클라이언트는 대회 등록이 불가합니다." }, { status: 403 });
  }

  const platform = await getPlatformSettings();
  if (platform.billingEnabled) {
    const hasMembership = await hasActiveClientMembership(gate.organizationId);
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

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
    verificationMode,
    verificationReviewRequired,
    eligibilityType,
    eligibilityValue,
    verificationGuideText,
    divisionEnabled,
    divisionMetricType,
    divisionRulesJson,
    // 구 필드 입력 호환
    certificationRequestMode,
    manualReviewRequired,
    eligibilityLimitType,
    eligibilityLimitValue,
  } = body as Record<string, unknown>;

  const nameStr = typeof name === "string" ? name.trim() : "";
  if (!nameStr || startAt == null || startAt === "") {
    return NextResponse.json({ error: "대회명, 일시를 입력해주세요." }, { status: 400 });
  }

  const verificationNorm = normalizeTournamentVerificationInput({
    verificationMode: verificationMode ?? certificationRequestMode,
    verificationReviewRequired: verificationReviewRequired ?? manualReviewRequired,
    eligibilityType: eligibilityType ?? eligibilityLimitType,
    eligibilityValue: eligibilityValue ?? eligibilityLimitValue,
    verificationGuideText,
    divisionEnabled,
    divisionMetricType,
    divisionRulesJson,
  });
  if (!verificationNorm.ok) {
    return NextResponse.json({ error: verificationNorm.error }, { status: 400 });
  }

  const fields: TournamentCreateFields = {
    name: nameStr,
    startAt: startAt as string,
    endAt: endAt as string | null | undefined,
    venue: venue as string | null | undefined,
    venueName: venueName as string | null | undefined,
    region: region as string | null | undefined,
    status: status as string | undefined,
    gameFormat: gameFormat as string | null | undefined,
    title: title as string | null | undefined,
    slug: slug as string | null | undefined,
    summary: summary as string | null | undefined,
    description: description as string | null | undefined,
    posterImageUrl: posterImageUrl as string | null | undefined,
    imageUrl: imageUrl as string | null | undefined,
    entryFee: entryFee as number | null | undefined,
    maxParticipants: maxParticipants as number | null | undefined,
    entryCondition: entryCondition as string | null | undefined,
    qualification: qualification as string | null | undefined,
    prizeInfo: prizeInfo as string | null | undefined,
    rules: rules as string | null | undefined,
    promoContent: promoContent as string | null | undefined,
    outlineDraft: outlineDraft as string | null | undefined,
    outlinePublished: outlinePublished as string | null | undefined,
    approvalType: approvalType as string | null | undefined,
    rule: rule && typeof rule === "object" ? rule : null,
    verification: verificationNorm.data,
  };

  const createData = buildTournamentCreateData(gate.organizationId, session.id, fields);

  try {
    const { id } = await insertTournamentWithRuleAndListing(createData, fields.rule);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const err = e as { message?: string };
    console.error("[client/tournaments POST]", e);
    return NextResponse.json(
      {
        error: "대회 생성 중 오류가 발생했습니다.",
        ...(process.env.NODE_ENV === "development" && err?.message && { detail: err.message }),
      },
      { status: 500 }
    );
  }
}
