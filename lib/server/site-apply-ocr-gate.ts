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


export type SiteApplyOcrGateEvaluation = {
  ok: boolean;
  userMessage: string;
  handicap: number | null;
  average: number | null;
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

  if (ocr.status !== "success" || !rawFull.trim()) {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }

  const parsed = parseOcrEligibilityText(rawFull);
  const rule = params.rule;
  if (!rule) {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }

  const applicantNameNorm = normalizeOcrPersonName(params.applicantName);
  const applicantPhoneDigits = digitsOnlyPhone(params.applicantPhone);
  const now = new Date();

  if (parsed.name == null || parsed.name.trim() === "") {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }
  if (applicantNameNorm.length === 0) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }
  if (normalizeOcrPersonName(parsed.name) !== applicantNameNorm) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }

  if (parsed.phone == null || parsed.phone.trim() === "") {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }
  const ocrPhoneDigits = digitsOnlyPhone(parsed.phone);
  if (applicantPhoneDigits.length === 0 || ocrPhoneDigits.length === 0) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }
  if (ocrPhoneDigits !== applicantPhoneDigits) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }

  if (parsed.issueDate == null) {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }
  if (!isIssueDateWithinThreeMonths(parsed.issueDate, now)) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }

  if (rule.entryQualificationType === "NONE") {
    return { ok: true, userMessage: MSG_USER_PASS, handicap: parsed.score, average: parsed.average };
  }

  const eligibilityCheck = checkOcrEligibility(parsed, rule);

  if (eligibilityCheck.passed === true) {
    return { ok: true, userMessage: MSG_USER_PASS, handicap: parsed.score, average: parsed.average };
  }
  if (eligibilityCheck.passed === false) {
    return { ok: false, userMessage: MSG_USER_MISMATCH, handicap: null, average: null };
  }

  if (eligibilityCheck.target === "UNKNOWN") {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }
  if (eligibilityCheck.limit == null) {
    return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
  }

  return { ok: false, userMessage: MSG_USER_READ_FAIL, handicap: null, average: null };
}
