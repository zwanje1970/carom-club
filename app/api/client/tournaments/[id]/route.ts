import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { sendPrizeNotifications } from "@/lib/push/prizeNotifications";
import {
  normalizeTournamentVerificationInput,
} from "@/lib/tournament-certification";
import { Prisma } from "@/generated/prisma";
import type { TeamScoreRule } from "@/generated/prisma";
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
    verificationMode,
    verificationReviewRequired,
    eligibilityType,
    eligibilityValue,
    verificationGuideText,
    divisionEnabled,
    divisionMetricType,
    divisionRulesJson,
      isScotch,
      teamScoreLimit,
      teamScoreRule,
    certificationRequestMode,
    manualReviewRequired,
    eligibilityLimitType,
    eligibilityLimitValue,
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
    verificationMode?: string;
    verificationReviewRequired?: boolean;
    eligibilityType?: string | null;
    eligibilityValue?: number | null;
    verificationGuideText?: string | null;
    divisionEnabled?: boolean;
    divisionMetricType?: string;
    divisionRulesJson?: unknown;
    isScotch?: boolean;
    teamScoreLimit?: number | string | null;
    teamScoreRule?: "LTE" | "LT" | null;
    certificationRequestMode?: string;
    manualReviewRequired?: boolean;
    eligibilityLimitType?: string | null;
    eligibilityLimitValue?: number | null;
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

  const hasVerificationPatch =
    verificationMode !== undefined ||
    verificationReviewRequired !== undefined ||
    eligibilityType !== undefined ||
    eligibilityValue !== undefined ||
    verificationGuideText !== undefined ||
    divisionEnabled !== undefined ||
    divisionMetricType !== undefined ||
    divisionRulesJson !== undefined ||
    certificationRequestMode !== undefined ||
    manualReviewRequired !== undefined ||
    eligibilityLimitType !== undefined ||
    eligibilityLimitValue !== undefined;
  const verificationPatch = hasVerificationPatch
    ? normalizeTournamentVerificationInput({
        verificationMode:
          verificationMode !== undefined
            ? verificationMode
            : certificationRequestMode !== undefined
              ? certificationRequestMode
              : tournament.verificationMode ?? tournament.certificationRequestMode,
        verificationReviewRequired:
          verificationReviewRequired !== undefined
            ? verificationReviewRequired
            : manualReviewRequired !== undefined
              ? manualReviewRequired
              : tournament.verificationReviewRequired ?? tournament.manualReviewRequired,
        eligibilityType:
          eligibilityType !== undefined
            ? eligibilityType
            : eligibilityLimitType !== undefined
              ? eligibilityLimitType
              : tournament.eligibilityType,
        eligibilityValue:
          eligibilityValue !== undefined
            ? eligibilityValue
            : eligibilityLimitValue !== undefined
              ? eligibilityLimitValue
              : tournament.eligibilityValue,
        verificationGuideText:
          verificationGuideText !== undefined ? verificationGuideText : tournament.verificationGuideText,
        divisionEnabled: divisionEnabled !== undefined ? divisionEnabled : tournament.divisionEnabled,
        divisionMetricType:
          divisionMetricType !== undefined ? divisionMetricType : tournament.divisionMetricType,
        divisionRulesJson:
          divisionRulesJson !== undefined ? divisionRulesJson : tournament.divisionRulesJson,
      })
    : null;
  if (verificationPatch && !verificationPatch.ok) {
    return NextResponse.json({ error: verificationPatch.error }, { status: 400 });
  }
  const isScotchTournament = isScotch === true || gameFormat === "SCOTCH";
  if (isScotchTournament) {
    const limitValue = teamScoreLimit == null || teamScoreLimit === "" ? null : Number(teamScoreLimit);
    if (!Number.isFinite(limitValue)) {
      return NextResponse.json({ error: "스카치 대회는 팀 점수 제한을 입력해 주세요." }, { status: 400 });
    }
  }

  try {
    await prisma.tournament.update({
      where: { id },
      data: ({
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
        ...(verificationPatch &&
          verificationPatch.ok && {
            verificationMode: verificationPatch.data.verificationMode,
            verificationReviewRequired: verificationPatch.data.verificationReviewRequired,
            eligibilityType: verificationPatch.data.eligibilityType,
            eligibilityValue: verificationPatch.data.eligibilityValue,
            verificationGuideText: verificationPatch.data.verificationGuideText,
            divisionEnabled: verificationPatch.data.divisionEnabled,
            divisionMetricType: verificationPatch.data.divisionMetricType,
            divisionRulesJson:
              verificationPatch.data.divisionRulesJson == null
                ? Prisma.JsonNull
                : (verificationPatch.data.divisionRulesJson as Prisma.InputJsonValue),
            // 구 필드 동시 저장(호환)
            certificationRequestMode: verificationPatch.data.verificationMode,
            manualReviewRequired: verificationPatch.data.verificationReviewRequired,
            eligibilityLimitType: verificationPatch.data.eligibilityType === "UNDER" ? "UNDER" : null,
            eligibilityLimitValue:
              verificationPatch.data.eligibilityType === "UNDER"
                ? verificationPatch.data.eligibilityValue
                : null,
          }),
        ...(isScotch !== undefined && { isScotch: isScotchTournament }),
        ...(teamScoreLimit !== undefined && {
          teamScoreLimit:
            isScotchTournament && teamScoreLimit != null && Number.isFinite(Number(teamScoreLimit))
              ? Number(teamScoreLimit)
              : null,
        }),
        ...(teamScoreRule !== undefined && {
          teamScoreRule: (isScotchTournament ? (teamScoreRule === "LT" ? "LT" : "LTE") : null) as TeamScoreRule | null,
        }),
      }) as Prisma.TournamentUpdateInput,
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

