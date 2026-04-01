import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { fillAdminCopyTemplate, getCopyValue } from "@/lib/admin-copy";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { isTrustedCertificationImageUrl } from "@/lib/tournament-cert-image-url";
import {
  matchDivisionByValue,
  parseDivisionMetricType,
  parseDivisionRulesJson,
  parseEligibilityType,
  parseMemberAverage,
  parseVerificationMode,
  requiresVerificationImage,
  shouldRunServerOcr,
  isEligibleUnderLimit,
  type VerificationReviewStatus,
} from "@/lib/tournament-certification";
import { runGoogleOcrOnImageBuffer } from "@/lib/server/google-ocr";
import { awardTournamentApply } from "@/lib/community-score-service";

function parseAllowMultipleSlots(rule: { bracketConfig?: string | object | null } | null): boolean {
  if (!rule?.bracketConfig) return false;
  try {
    const raw =
      typeof rule.bracketConfig === "string" ? JSON.parse(rule.bracketConfig) : rule.bracketConfig;
    const c = raw as Record<string, unknown>;
    return c.allowMultipleSlots === true;
  } catch {
    return false;
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

  let body: {
    tournamentId?: string;
    depositorName?: string;
    clubOrAffiliation?: string;
    additionalSlot?: boolean;
    handicap?: string;
    avg?: string;
    avgProofUrl?: string;
    verificationImageUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 }
    );
  }
  const {
    tournamentId,
    depositorName,
    clubOrAffiliation,
    additionalSlot,
    handicap,
    avg,
    avgProofUrl,
    verificationImageUrl,
  } = body;
  const club = typeof clubOrAffiliation === "string" ? clubOrAffiliation.trim() || null : null;
  const handicapVal = typeof handicap === "string" ? handicap.trim() || null : null;
  const avgVal = typeof avg === "string" ? avg.trim() || null : null;
  const avgProofVal = typeof avgProofUrl === "string" ? avgProofUrl.trim() || null : null;

  const copy = await getAdminCopy();

  if (!tournamentId || !depositorName?.trim()) {
    return NextResponse.json(
      { error: "대회 선택과 입금자명이 필요합니다." },
      { status: 400 }
    );
  }

  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없거나 비공개 대회입니다." }, { status: 404 });
  }
  if (tournament.status === "FINISHED") {
    return NextResponse.json({ error: "종료된 대회에는 참가 신청할 수 없습니다." }, { status: 400 });
  }
  if (tournament.status === "CLOSED") {
    return NextResponse.json({ error: "참가 신청이 마감되었습니다." }, { status: 400 });
  }
  if (tournament.status === "DRAFT") {
    return NextResponse.json({ error: "아직 참가 신청을 받지 않습니다. 운영자 안내를 기다려 주세요." }, { status: 400 });
  }
  if (tournament.status !== "OPEN") {
    return NextResponse.json({ error: "현재 모집 중이 아닙니다. 참가 신청을 받지 않습니다." }, { status: 400 });
  }

  const tournamentWithRule = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournamentWithRule) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const verificationMode = parseVerificationMode(
    tournamentWithRule.verificationMode ?? tournamentWithRule.certificationRequestMode
  );
  const eligibilityType = parseEligibilityType(
    tournamentWithRule.eligibilityType ??
      (tournamentWithRule.eligibilityLimitType === "UNDER" ? "UNDER" : "NONE")
  );
  const eligibilityValue =
    tournamentWithRule.eligibilityValue ??
    (tournamentWithRule.eligibilityLimitType === "UNDER" ? tournamentWithRule.eligibilityLimitValue : null);
  const verificationReviewRequired =
    tournamentWithRule.verificationReviewRequired ?? tournamentWithRule.manualReviewRequired ?? true;
  const divisionEnabled = tournamentWithRule.divisionEnabled === true;
  const divisionMetricType = parseDivisionMetricType(tournamentWithRule.divisionMetricType);
  const divisionRules = parseDivisionRulesJson(tournamentWithRule.divisionRulesJson);

  const userRow = await prisma.user.findUnique({
    where: { id: session.id },
    include: { memberProfile: true },
  });
  const memberAvg = parseMemberAverage(userRow?.memberProfile?.avg ?? null);
  const memberScore = parseMemberAverage(userRow?.memberProfile?.handicap ?? null);
  const submittedAvg = parseMemberAverage(avgVal);
  const submittedScore = parseMemberAverage(handicapVal);
  const divisionMetricValue =
    divisionMetricType === "SCORE"
      ? memberScore ?? submittedScore
      : memberAvg ?? submittedAvg;

  // 1) 참가 제한 검증
  if (eligibilityType === "UNDER" && eligibilityValue != null && Number.isFinite(eligibilityValue)) {
    const userAvg = memberAvg;
    if (userAvg === null) {
      return NextResponse.json(
        { error: getCopyValue(copy, "site.tournament.apply.eligibilityNoAvg") },
        { status: 400 }
      );
    }
    if (!isEligibleUnderLimit(userAvg, eligibilityValue)) {
      return NextResponse.json(
        {
          error: fillAdminCopyTemplate(getCopyValue(copy, "site.tournament.apply.eligibilityUnderFail"), {
            value: String(eligibilityValue),
          }),
        },
        { status: 400 }
      );
    }
  }

  // 2) 인증파일 검증
  const verificationImageUrlRaw = typeof verificationImageUrl === "string" ? verificationImageUrl.trim() : "";

  if (requiresVerificationImage(verificationMode)) {
    if (!verificationImageUrlRaw) {
      return NextResponse.json(
        { error: getCopyValue(copy, "site.tournament.apply.certRequired") },
        { status: 400 }
      );
    }
    if (!isTrustedCertificationImageUrl(verificationImageUrlRaw)) {
      return NextResponse.json({ error: "인증 이미지 URL이 유효하지 않습니다. 다시 업로드해 주세요." }, { status: 400 });
    }
  }

  const allowMultipleSlots = parseAllowMultipleSlots(tournamentWithRule.rule);
  const baseEntryFee = tournamentWithRule.rule?.entryFee ?? tournamentWithRule.entryFee ?? 0;

  const existingEntries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, userId: session.id },
    select: { id: true, status: true, slotNumber: true },
    orderBy: { slotNumber: "asc" },
  });

  const nonCanceled = existingEntries.filter((e) => e.status !== "CANCELED");
  const maxSlot = existingEntries.length > 0 ? Math.max(...existingEntries.map((e) => e.slotNumber)) : 0;
  const nextSlotNumber = maxSlot + 1;

  if (!allowMultipleSlots) {
    if (nonCanceled.length > 0) {
      return NextResponse.json(
        { error: "이미 참가 신청하셨습니다. 이 대회는 중복 참가를 허용하지 않습니다." },
        { status: 400 }
      );
    }
    const canceled = existingEntries.find((e) => e.status === "CANCELED");
    if (canceled) {
      await prisma.tournamentEntry.delete({ where: { id: canceled.id } });
    }
  } else {
    if (additionalSlot && nonCanceled.length === 0) {
      return NextResponse.json(
        { error: "먼저 1슬롯 참가 신청을 완료한 후 추가 슬롯을 신청할 수 있습니다." },
        { status: 400 }
      );
    }
    if (!additionalSlot && nonCanceled.length > 0) {
      return NextResponse.json(
        {
          error: "이미 참가 신청하셨습니다. 추가 슬롯을 원하시면 '추가 슬롯 신청 (참가비 2배)'을 이용해 주세요.",
        },
        { status: 400 }
      );
    }
  }

  const maxEntries = tournamentWithRule.rule?.maxEntries ?? tournamentWithRule.maxParticipants ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const useWaiting = tournamentWithRule.rule?.useWaiting ?? false;
  const isFull = maxEntries > 0 && confirmedCount >= maxEntries;

  try {
    if (isFull && !useWaiting) {
      return NextResponse.json(
        { error: "정원이 마감되었습니다. 참가 신청을 받지 않습니다." },
        { status: 400 }
      );
    }

    const isAdditionalSlot = allowMultipleSlots && nextSlotNumber >= 2;
    const entryFeeAmount = isAdditionalSlot ? baseEntryFee * 2 : baseEntryFee;

    const needsVerificationImage = requiresVerificationImage(verificationMode);
    const divisionMatch = divisionEnabled
      ? matchDivisionByValue(divisionMetricValue, divisionRules)
      : { divisionName: null, divisionMatchedValue: null, divisionMatchedAverage: null };
    const divisionMatched = divisionEnabled ? divisionMatch.divisionName != null : true;
    const reviewInitial: VerificationReviewStatus | null =
      !needsVerificationImage && !divisionEnabled
        ? null
        : verificationReviewRequired || !divisionMatched
          ? "PENDING"
          : "APPROVED";

    const ocrInitial =
      !needsVerificationImage
        ? null
        : verificationMode === "MANUAL"
          ? "SKIPPED"
          : verificationMode === "AUTO"
            ? "PENDING"
            : null;

    // 3) division 매칭 반영 후
    // 4) 신청 저장
    const entry = await prisma.tournamentEntry.create({
      data: {
        tournamentId,
        userId: session.id,
        slotNumber: nextSlotNumber,
        status: "APPLIED",
        depositorName: depositorName.trim(),
        clubOrAffiliation: club,
        handicap: handicapVal,
        avg: avgVal,
        avgProofUrl: avgProofVal,
        entryFeeAmount: baseEntryFee > 0 ? entryFeeAmount : null,
        verificationImageUrl: needsVerificationImage ? verificationImageUrlRaw : null,
        verificationOcrText: null,
        verificationOcrStatus: ocrInitial,
        verificationReviewStatus: reviewInitial,
        divisionName: divisionMatch.divisionName,
        divisionMatchedValue: divisionMatch.divisionMatchedValue,
        divisionMatchedAverage: divisionMatch.divisionMatchedAverage,
        // 구 필드 동시 저장(호환)
        certificationImageUrl: needsVerificationImage ? verificationImageUrlRaw : null,
        certificationOcrText: null,
        certificationOcrStatus:
          ocrInitial == null
            ? null
            : ocrInitial === "PENDING"
              ? "pending"
              : ocrInitial === "SKIPPED"
                ? "skipped"
                : ocrInitial === "FAILED"
                  ? "failed"
                  : "success",
        certificationReviewStatus:
          reviewInitial == null
            ? null
            : reviewInitial === "PENDING"
              ? "pending"
              : "approved",
      },
    });

    // 5) OCR 실행 (AUTO, 1회)
    if (shouldRunServerOcr(verificationMode) && verificationImageUrlRaw) {
      try {
        const imgRes = await fetch(verificationImageUrlRaw);
        if (!imgRes.ok) throw new Error(`fetch ${imgRes.status}`);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const ocr = await runGoogleOcrOnImageBuffer(buf);
        const ocrStatus = ocr.status === "success" ? "SUCCESS" : "FAILED";
        await prisma.tournamentEntry.update({
          where: { id: entry.id },
          data: {
            verificationOcrText: ocr.text || null,
            verificationOcrStatus: ocrStatus,
            verificationReviewStatus: ocrStatus === "FAILED" ? "PENDING" : reviewInitial,
            // 구 필드 동시 저장(호환)
            certificationOcrText: ocr.text || null,
            certificationOcrStatus: ocr.status === "success" ? "success" : "failed",
            certificationReviewStatus:
              ocrStatus === "FAILED"
                ? "pending"
                : reviewInitial == null
                  ? null
                  : reviewInitial === "PENDING"
                    ? "pending"
                    : "approved",
          },
        });
      } catch (ocrErr) {
        console.error("[tournaments/apply] OCR error", ocrErr);
        await prisma.tournamentEntry.update({
          where: { id: entry.id },
          data: {
            verificationOcrStatus: "FAILED",
            verificationOcrText: null,
            verificationReviewStatus: "PENDING",
            // 구 필드 동시 저장(호환)
            certificationOcrStatus: "failed",
            certificationOcrText: null,
            certificationReviewStatus: "pending",
          },
        });
      }
    }

    try {
      await awardTournamentApply(session.id, entry.id);
    } catch (_) {}

    const feeMessage =
      nextSlotNumber === 1
        ? baseEntryFee > 0
          ? `참가비 ${baseEntryFee.toLocaleString()}원`
          : ""
        : baseEntryFee > 0
          ? `추가 슬롯 참가비 ${(baseEntryFee * 2).toLocaleString()}원 (2배)`
          : "";

    return NextResponse.json({
      ok: true,
      status: "APPLIED",
      slotNumber: nextSlotNumber,
      message:
        nextSlotNumber >= 2
          ? `추가 슬롯(슬롯${nextSlotNumber}) 신청이 접수되었습니다. ${feeMessage} 입금 후 '입금 완료'를 체크해 주세요.`
          : "참가 신청이 접수되었습니다. 입금 후 아래에서 '입금 완료'를 체크해 주세요. 관리자 입금확인 순으로 참가가 확정됩니다.",
    });
  } catch (e) {
    console.error("apply error", e);
    return NextResponse.json(
      { error: "참가 신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
