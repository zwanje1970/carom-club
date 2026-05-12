import {
  checkOcrEligibility,
  digitsOnlyPhone,
  isIssueDateWithinThreeMonths,
  normalizeOcrPersonName,
  parseOcrEligibilityText,
} from "./ocr-eligibility-parser";
import type { OcrEligibilityParsed } from "./ocr-eligibility-parser";
import { runOcrForProofImageAsset } from "./ocr-service";
import type { ProofImageAsset, TournamentRuleSnapshot } from "./platform-backing-store";

/** 사용자 노출 최종 메시지 (3종만 사용). */
const MSG_USER_READ_FAIL = "판독불가, 재업로드 요망";
const MSG_USER_MISMATCH = "신청조건 불일치";
const MSG_USER_PASS = "판독성공 조건일치";

/* ----- BEGIN OCR_GATE_TEMP_DEBUG (원인 확인용 — 배포 전 제거) ----- */
const OCR_GATE_TEMP_DEBUG = true;

function serializeParsedForOcrDebug(p: OcrEligibilityParsed) {
  const id =
    p.issueDate instanceof Date && !Number.isNaN(p.issueDate.getTime())
      ? p.issueDate.toISOString()
      : null;
  return { name: p.name, phone: p.phone, score: p.score, average: p.average, issueDate: id };
}

function serializeRuleForOcrDebug(rule: TournamentRuleSnapshot | null | undefined) {
  if (!rule) return null;
  return {
    entryQualificationType: rule.entryQualificationType,
    eligibilityValue: rule.eligibilityValue,
    eligibilityCompare: rule.eligibilityCompare,
  };
}

function ocrGateDebugEmit(payload: Record<string, unknown>): void {
  if (!OCR_GATE_TEMP_DEBUG) return;
  try {
    console.log("[OCR_GATE_DEBUG]", JSON.stringify(payload));
  } catch {
    console.log("[OCR_GATE_DEBUG]", String(payload.firstFailReason ?? "emit_failed"));
  }
}
/* ----- END OCR_GATE_TEMP_DEBUG ----- */

export type SiteApplyOcrGateEvaluation = {
  ok: boolean;
  userMessage: string;
};

/**
 * 사이트 참가신청 저장 전 OCR·자격 판정 게이트. 참가자 status를 바꾸지 않는다.
 */
export async function evaluateSiteApplyOcrGate(params: {
  proofImage: ProofImageAsset;
  rule: TournamentRuleSnapshot | null | undefined;
  mockOcrSeed?: { depositorName: string; phone: string };
  applicantName: string;
  applicantPhone: string;
}): Promise<SiteApplyOcrGateEvaluation> {
  const ocr = await runOcrForProofImageAsset(params.proofImage, {
    depositorName: params.mockOcrSeed?.depositorName ?? "",
    phone: params.mockOcrSeed?.phone ?? "",
    applicantName: params.applicantName,
  });
  const rawFull = ocr.rawText ?? "";
  const rawSnippet = rawFull.slice(0, 2000);

  if (ocr.status !== "success" || !rawFull.trim()) {
    ocrGateDebugEmit({
      firstFailReason: "ocr_empty_or_failed",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: null,
      rule: serializeRuleForOcrDebug(params.rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }

  const parsed = parseOcrEligibilityText(rawFull);
  const rule = params.rule;
  if (!rule) {
    ocrGateDebugEmit({
      firstFailReason: "rule_missing",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: null,
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }

  const applicantNameNorm = normalizeOcrPersonName(params.applicantName);
  const applicantPhoneDigits = digitsOnlyPhone(params.applicantPhone);
  const now = new Date();

  if (parsed.name == null || parsed.name.trim() === "") {
    ocrGateDebugEmit({
      firstFailReason: "parsed_name_missing",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }
  if (applicantNameNorm.length === 0) {
    ocrGateDebugEmit({
      firstFailReason: "applicant_name_empty_after_normalize",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }
  if (normalizeOcrPersonName(parsed.name) !== applicantNameNorm) {
    ocrGateDebugEmit({
      firstFailReason: "applicant_name_mismatch_ocr_vs_form",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      parsedNameNormalized: normalizeOcrPersonName(parsed.name),
      applicantNameNormalized: applicantNameNorm,
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }

  if (parsed.phone == null || parsed.phone.trim() === "") {
    ocrGateDebugEmit({
      firstFailReason: "parsed_phone_missing",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }
  const ocrPhoneDigits = digitsOnlyPhone(parsed.phone);
  if (applicantPhoneDigits.length === 0 || ocrPhoneDigits.length === 0) {
    ocrGateDebugEmit({
      firstFailReason: "applicant_or_ocr_phone_digits_empty",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      applicantPhoneDigits,
      ocrPhoneDigits,
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }
  if (ocrPhoneDigits !== applicantPhoneDigits) {
    ocrGateDebugEmit({
      firstFailReason: "applicant_phone_mismatch_ocr_vs_form",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      applicantPhoneDigits,
      ocrPhoneDigits,
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }

  if (parsed.issueDate == null) {
    ocrGateDebugEmit({
      firstFailReason: "parsed_issue_date_missing",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }
  if (!isIssueDateWithinThreeMonths(parsed.issueDate, now)) {
    ocrGateDebugEmit({
      firstFailReason: "issue_date_outside_three_month_window",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }

  if (rule.entryQualificationType === "NONE") {
    ocrGateDebugEmit({
      firstFailReason: null,
      gateOk: true,
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      userMessage: MSG_USER_PASS,
    });
    return { ok: true, userMessage: MSG_USER_PASS };
  }

  const eligibilityCheck = checkOcrEligibility(parsed, rule);

  if (eligibilityCheck.passed === true) {
    ocrGateDebugEmit({
      firstFailReason: null,
      gateOk: true,
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      eligibilityCheck: {
        target: eligibilityCheck.target,
        passed: eligibilityCheck.passed,
        limit: eligibilityCheck.limit,
        compare: eligibilityCheck.compare,
        internalMessage: eligibilityCheck.message,
      },
      userMessage: MSG_USER_PASS,
    });
    return { ok: true, userMessage: MSG_USER_PASS };
  }
  if (eligibilityCheck.passed === false) {
    ocrGateDebugEmit({
      firstFailReason: "eligibility_numeric_or_rule_failed",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      eligibilityCheck: {
        target: eligibilityCheck.target,
        passed: eligibilityCheck.passed,
        limit: eligibilityCheck.limit,
        compare: eligibilityCheck.compare,
        extractedValue: eligibilityCheck.extractedValue,
        internalMessage: eligibilityCheck.message,
      },
      userMessage: MSG_USER_MISMATCH,
    });
    return { ok: false, userMessage: MSG_USER_MISMATCH };
  }

  if (eligibilityCheck.target === "UNKNOWN") {
    ocrGateDebugEmit({
      firstFailReason: "eligibility_target_unknown",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      eligibilityCheck: {
        target: eligibilityCheck.target,
        passed: eligibilityCheck.passed,
        limit: eligibilityCheck.limit,
        internalMessage: eligibilityCheck.message,
      },
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }
  if (eligibilityCheck.limit == null) {
    ocrGateDebugEmit({
      firstFailReason: "eligibility_limit_null",
      ocrStatus: ocr.status,
      ocrProvider: ocr.provider,
      rawTextLen: rawFull.length,
      rawText: rawSnippet,
      parsed: serializeParsedForOcrDebug(parsed),
      rule: serializeRuleForOcrDebug(rule),
      applicantName: params.applicantName,
      applicantPhone: params.applicantPhone,
      eligibilityCheck: {
        target: eligibilityCheck.target,
        passed: eligibilityCheck.passed,
        limit: eligibilityCheck.limit,
        internalMessage: eligibilityCheck.message,
      },
      userMessage: MSG_USER_READ_FAIL,
    });
    return { ok: false, userMessage: MSG_USER_READ_FAIL };
  }

  ocrGateDebugEmit({
    firstFailReason: `eligibility_passed_null:${eligibilityCheck.target}`,
    ocrStatus: ocr.status,
    ocrProvider: ocr.provider,
    rawTextLen: rawFull.length,
    rawText: rawSnippet,
    parsed: serializeParsedForOcrDebug(parsed),
    rule: serializeRuleForOcrDebug(rule),
    applicantName: params.applicantName,
    applicantPhone: params.applicantPhone,
    eligibilityCheck: {
      target: eligibilityCheck.target,
      passed: eligibilityCheck.passed,
      limit: eligibilityCheck.limit,
      compare: eligibilityCheck.compare,
      extractedValue: eligibilityCheck.extractedValue,
      internalMessage: eligibilityCheck.message,
    },
    userMessage: MSG_USER_READ_FAIL,
  });
  return { ok: false, userMessage: MSG_USER_READ_FAIL };
}
