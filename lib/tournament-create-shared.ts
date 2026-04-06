/**
 * 대회 생성 DB 반영 — /api/admin/tournaments POST 와 /api/client/tournaments POST 가 공유.
 */
import { prisma } from "@/lib/db";
import { createListingPurchaseRecord } from "@/lib/listing-registration";
import type { TournamentVerificationDbInput } from "@/lib/tournament-certification";
import { inferNationalTournamentFromRegion } from "@/lib/tournament-national";
import type { TeamScoreRule } from "@/generated/prisma";

export type TournamentCreateRulePayload = {
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

export type TournamentCreateFields = {
  name: string;
  startAt: string;
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
  outlinePdfUrl?: string | null;
  outlineDraft?: string | null;
  outlinePublished?: string | null;
  approvalType?: string | null;
  isScotch?: boolean;
  teamScoreLimit?: number | null;
  teamScoreRule?: "LTE" | "LT" | null;
  rule?: TournamentCreateRulePayload | null;
  verification?: TournamentVerificationDbInput | null;
};

export function normalizeTournamentCreateStatus(status: string | undefined): "DRAFT" | "OPEN" | "CLOSED" | "FINISHED" | "HIDDEN" {
  if (typeof status === "string" && ["DRAFT", "OPEN", "CLOSED", "FINISHED", "HIDDEN"].includes(status)) {
    return status as "DRAFT" | "OPEN" | "CLOSED" | "FINISHED" | "HIDDEN";
  }
  return "OPEN";
}

export function buildTournamentCreateData(
  organizationId: string,
  createdByUserId: string,
  f: TournamentCreateFields
) {
  const validStatus = normalizeTournamentCreateStatus(f.status);
  const createData = {
    organizationId,
    createdByUserId,
    name: f.name.trim(),
    startAt: new Date(f.startAt),
    ...(f.endAt != null && f.endAt !== "" && { endAt: new Date(f.endAt) }),
    venue: f.venue != null ? String(f.venue).trim() || null : null,
    venueName: f.venueName != null ? String(f.venueName).trim() || null : null,
    region: f.region != null ? String(f.region).trim() || null : null,
    nationalTournament: inferNationalTournamentFromRegion(
      f.region != null ? String(f.region).trim() || null : null
    ),
    status: validStatus,
    gameFormat: f.gameFormat != null ? String(f.gameFormat).trim() || null : null,
    title: f.title != null ? String(f.title).trim() || null : null,
    slug: f.slug != null ? String(f.slug).trim() || null : null,
    summary: f.summary != null ? String(f.summary).trim() || null : null,
    description: f.description != null ? String(f.description).trim() || null : null,
    posterImageUrl: f.posterImageUrl != null ? String(f.posterImageUrl).trim() || null : null,
    imageUrl: f.imageUrl != null ? String(f.imageUrl).trim() || null : null,
    entryFee: f.entryFee != null && Number.isFinite(Number(f.entryFee)) ? Number(f.entryFee) : null,
    maxParticipants:
      f.maxParticipants != null && Number.isFinite(Number(f.maxParticipants)) ? Number(f.maxParticipants) : null,
    entryCondition: f.entryCondition != null ? String(f.entryCondition).trim() || null : null,
    qualification: f.qualification != null ? String(f.qualification).trim() || null : null,
    prizeInfo: f.prizeInfo != null ? String(f.prizeInfo).trim() || null : null,
    rules: f.rules != null ? String(f.rules).trim() || null : null,
    promoContent: f.promoContent != null ? String(f.promoContent).trim() || null : null,
    outlinePdfUrl: f.outlinePdfUrl != null ? String(f.outlinePdfUrl).trim() || null : null,
    outlineDraft: f.outlineDraft != null ? String(f.outlineDraft).trim() || null : null,
    outlinePublished: f.outlinePublished != null ? String(f.outlinePublished).trim() || null : null,
    approvalType: f.approvalType != null ? String(f.approvalType).trim() || undefined : undefined,
    isScotch: f.isScotch === true,
    teamScoreLimit:
      f.teamScoreLimit != null && Number.isFinite(Number(f.teamScoreLimit)) ? Number(f.teamScoreLimit) : null,
    teamScoreRule: (f.teamScoreRule === "LT" ? "LT" : "LTE") as TeamScoreRule,
    ...(f.verification != null && {
      verificationMode: f.verification.verificationMode,
      verificationReviewRequired: f.verification.verificationReviewRequired,
      eligibilityType: f.verification.eligibilityType,
      eligibilityValue: f.verification.eligibilityValue,
      verificationGuideText: f.verification.verificationGuideText,
      divisionEnabled: f.verification.divisionEnabled,
      divisionMetricType: f.verification.divisionMetricType,
      ...(f.verification.divisionRulesJson != null && {
        divisionRulesJson: f.verification.divisionRulesJson as object,
      }),
      // 구 필드 호환 저장
      certificationRequestMode: f.verification.verificationMode,
      manualReviewRequired: f.verification.verificationReviewRequired,
      eligibilityLimitType: f.verification.eligibilityType === "UNDER" ? "UNDER" : null,
      eligibilityLimitValue: f.verification.eligibilityType === "UNDER" ? f.verification.eligibilityValue : null,
    }),
  };
  return createData;
}

export async function insertTournamentWithRuleAndListing(
  createData: ReturnType<typeof buildTournamentCreateData>,
  rule: TournamentCreateRulePayload | null | undefined
): Promise<{ id: string }> {
  console.time("createTournament");
  const tournament = await (async () => {
    try {
      return await prisma.tournament.create({
        data: createData,
        select: { id: true },
      });
    } finally {
      console.timeEnd("createTournament");
    }
  })();
  Promise.resolve().then(async () => {
    try {
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
      await createListingPurchaseRecord({
        organizationId: createData.organizationId,
        listingCode: "TOURNAMENT_POSTING",
        targetType: "TOURNAMENT",
        targetId: tournament.id,
      });
    } catch (err) {
      console.warn("post-create background tasks failed:", err);
    }
  });

  return { id: tournament.id };
}
