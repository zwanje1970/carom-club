import { checkOcrEligibility, parseOcrEligibilityText } from "./ocr-eligibility-parser";
import { runOcrForProofImageAsset } from "./ocr-service";
import type { ProofImageAsset, TournamentRuleSnapshot } from "./platform-backing-store";

const MSG_PASS = "핸디/AVG 기준 적합";
const MSG_INCONCLUSIVE = "판독불가, 재업로드 요망";
const MSG_FAIL = "핸디/AVG 기준 부적합";

export type SiteApplyOcrGateEvaluation = {
  ok: boolean;
  userMessage: string;
};

/**
 * 사이트 참가신청 저장 전 OCR·자격 참고 판정 게이트. 참가자 status를 바꾸지 않는다.
 */
export async function evaluateSiteApplyOcrGate(params: {
  proofImage: ProofImageAsset;
  rule: TournamentRuleSnapshot | null | undefined;
  mockOcrSeed?: { depositorName: string; phone: string };
}): Promise<SiteApplyOcrGateEvaluation> {
  const ocr = await runOcrForProofImageAsset(params.proofImage, params.mockOcrSeed);
  if (ocr.status !== "success" || !ocr.rawText.trim()) {
    return { ok: false, userMessage: MSG_INCONCLUSIVE };
  }

  const rule = params.rule;
  if (!rule) {
    return { ok: false, userMessage: MSG_INCONCLUSIVE };
  }

  const parsed = parseOcrEligibilityText(ocr.rawText);
  const eligibilityCheck = checkOcrEligibility(parsed, rule);

  if (rule.entryQualificationType === "NONE") {
    return { ok: true, userMessage: MSG_PASS };
  }

  if (eligibilityCheck.passed === true) {
    return { ok: true, userMessage: MSG_PASS };
  }
  if (eligibilityCheck.passed === false) {
    return { ok: false, userMessage: MSG_FAIL };
  }
  return { ok: false, userMessage: MSG_INCONCLUSIVE };
}
