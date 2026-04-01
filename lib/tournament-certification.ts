/**
 * verification/division 공용 타입·정규화·판정 유틸
 * - 신규 표준: verification* / division*
 * - 구 필드(certification*)는 호환용 fallback에서만 사용
 */

export const VERIFICATION_MODES = ["NONE", "AUTO", "MANUAL"] as const;
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

export const ELIGIBILITY_TYPES = ["NONE", "UNDER"] as const;
export type EligibilityType = (typeof ELIGIBILITY_TYPES)[number];

export const VERIFICATION_OCR_STATUSES = ["PENDING", "SUCCESS", "FAILED", "SKIPPED"] as const;
export type VerificationOcrStatus = (typeof VERIFICATION_OCR_STATUSES)[number];

export const VERIFICATION_REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type VerificationReviewStatus = (typeof VERIFICATION_REVIEW_STATUSES)[number];

export const DIVISION_METRIC_TYPES = ["AVERAGE", "SCORE"] as const;
export type DivisionMetricType = (typeof DIVISION_METRIC_TYPES)[number];

export type DivisionRule = {
  name: string;
  min: number | null;
  max: number | null;
};

const MODE_SET = new Set<string>(VERIFICATION_MODES);
const ELIG_SET = new Set<string>(ELIGIBILITY_TYPES);
const OCR_SET = new Set<string>(VERIFICATION_OCR_STATUSES);
const REVIEW_SET = new Set<string>(VERIFICATION_REVIEW_STATUSES);
const DIVISION_METRIC_SET = new Set<string>(DIVISION_METRIC_TYPES);

export function parseVerificationMode(raw: string | null | undefined): VerificationMode {
  if (raw != null && MODE_SET.has(raw)) return raw as VerificationMode;
  return "NONE";
}

export function parseEligibilityType(raw: string | null | undefined): EligibilityType {
  if (raw != null && ELIG_SET.has(raw)) return raw as EligibilityType;
  return "NONE";
}

export function parseVerificationOcrStatus(raw: string | null | undefined): VerificationOcrStatus | null {
  if (raw == null || raw === "") return null;
  if (OCR_SET.has(raw)) return raw as VerificationOcrStatus;
  const lower = raw.toLowerCase();
  if (lower === "pending") return "PENDING";
  if (lower === "success") return "SUCCESS";
  if (lower === "failed") return "FAILED";
  if (lower === "skipped") return "SKIPPED";
  return null;
}

export function parseVerificationReviewStatus(raw: string | null | undefined): VerificationReviewStatus | null {
  if (raw == null || raw === "") return null;
  if (REVIEW_SET.has(raw)) return raw as VerificationReviewStatus;
  const lower = raw.toLowerCase();
  if (lower === "pending") return "PENDING";
  if (lower === "approved") return "APPROVED";
  if (lower === "rejected") return "REJECTED";
  return null;
}

export function parseDivisionMetricType(raw: string | null | undefined): DivisionMetricType {
  if (raw != null && DIVISION_METRIC_SET.has(raw)) return raw as DivisionMetricType;
  return "AVERAGE";
}

export function requiresVerificationImage(mode: VerificationMode): boolean {
  return mode === "AUTO" || mode === "MANUAL";
}

export function shouldRunServerOcr(mode: VerificationMode): boolean {
  return mode === "AUTO";
}

/**
 * 회원 프로필 AVG 문자열 → 숫자. 미등록·비파싱 시 null.
 */
export function parseMemberAverage(avg: string | null | undefined): number | null {
  if (avg == null || typeof avg !== "string") return null;
  const t = avg.trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * UNDER 제한: userAvg < limit (미만, 이하 아님)
 */
export function isEligibleUnderLimit(userAvg: number | null, limit: number): boolean {
  if (userAvg === null || Number.isNaN(userAvg)) return false;
  return userAvg < limit;
}

/**
 * division 규칙 파싱.
 * 허용: [{name,min,max}, ...]
 */
export function parseDivisionRulesJson(raw: unknown): DivisionRule[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: DivisionRule[] = [];
  for (const it of arr) {
    if (it == null || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const minRaw = row.min;
    const maxRaw = row.max;
    const min = minRaw == null ? null : Number(minRaw);
    const max = maxRaw == null ? null : Number(maxRaw);
    if (!name) continue;
    if (min != null && !Number.isFinite(min)) continue;
    if (max != null && !Number.isFinite(max)) continue;
    if (min != null && max != null && min >= max) continue;
    out.push({ name, min, max });
  }
  return out;
}

/**
 * 규칙: min <= avg < max
 * - min=null: 하한 없음
 * - max=null: 상한 없음
 */
export function matchDivisionByValue(
  value: number | null,
  rules: DivisionRule[]
): { divisionName: string | null; divisionMatchedValue: number | null; divisionMatchedAverage: number | null } {
  if (value == null || Number.isNaN(value)) {
    return { divisionName: null, divisionMatchedValue: null, divisionMatchedAverage: null };
  }
  for (const rule of rules) {
    const minOk = rule.min == null || rule.min <= value;
    const maxOk = rule.max == null || value < rule.max;
    if (minOk && maxOk) {
      return { divisionName: rule.name, divisionMatchedValue: value, divisionMatchedAverage: value };
    }
  }
  return { divisionName: null, divisionMatchedValue: value, divisionMatchedAverage: value };
}

export function matchDivisionByAverage(
  avg: number | null,
  rules: DivisionRule[]
): { divisionName: string | null; divisionMatchedAverage: number | null } {
  const matched = matchDivisionByValue(avg, rules);
  return { divisionName: matched.divisionName, divisionMatchedAverage: matched.divisionMatchedAverage };
}

export const VERIFICATION_MODE_FORM_OPTIONS: readonly { value: VerificationMode; labelKey: string }[] = [
  { value: "NONE", labelKey: "client.tournamentForm.certMode.none" },
  { value: "AUTO", labelKey: "client.tournamentForm.certMode.auto" },
  { value: "MANUAL", labelKey: "client.tournamentForm.certMode.manual" },
];

export const ELIGIBILITY_TYPE_FORM_OPTIONS: readonly { value: EligibilityType; labelKey: string }[] = [
  { value: "NONE", labelKey: "client.tournamentForm.eligibility.none" },
  { value: "UNDER", labelKey: "client.tournamentForm.eligibility.under" },
];

export const DIVISION_METRIC_TYPE_FORM_OPTIONS: readonly { value: DivisionMetricType; labelKey: string }[] = [
  { value: "AVERAGE", labelKey: "client.tournamentForm.division.metric.average" },
  { value: "SCORE", labelKey: "client.tournamentForm.division.metric.score" },
];

export type TournamentVerificationDbInput = {
  verificationMode: VerificationMode;
  verificationReviewRequired: boolean;
  eligibilityType: EligibilityType;
  eligibilityValue: number | null;
  verificationGuideText: string | null;
  divisionEnabled: boolean;
  divisionMetricType: DivisionMetricType;
  divisionRulesJson: unknown | null;
};

/**
 * API/폼 입력 정규화 (신규 verification/division 기준)
 */
export function normalizeTournamentVerificationInput(raw: {
  verificationMode?: unknown;
  verificationReviewRequired?: unknown;
  eligibilityType?: unknown;
  eligibilityValue?: unknown;
  verificationGuideText?: unknown;
  divisionEnabled?: unknown;
  divisionMetricType?: unknown;
  divisionRulesJson?: unknown;
}): { ok: true; data: TournamentVerificationDbInput } | { ok: false; error: string } {
  const verificationMode = parseVerificationMode(
    typeof raw.verificationMode === "string" ? raw.verificationMode : undefined
  );
  const verificationReviewRequired = raw.verificationReviewRequired === false ? false : true;
  const eligibilityType = parseEligibilityType(
    typeof raw.eligibilityType === "string" ? raw.eligibilityType : undefined
  );
  const verificationGuideText =
    typeof raw.verificationGuideText === "string" ? raw.verificationGuideText.trim() || null : null;
  const divisionEnabled = raw.divisionEnabled === true;
  const divisionMetricType = parseDivisionMetricType(
    typeof raw.divisionMetricType === "string" ? raw.divisionMetricType : undefined
  );
  const divisionRules = parseDivisionRulesJson(raw.divisionRulesJson);

  let eligibilityValue: number | null = null;
  if (eligibilityType === "UNDER") {
    const v = raw.eligibilityValue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v.trim()) : NaN;
    if (!Number.isFinite(n)) return { ok: false, error: "참가 제한 기준값이 필요합니다." };
    eligibilityValue = n;
  }

  if (divisionEnabled && divisionRules.length === 0) {
    return { ok: false, error: "자동 부 분배를 사용하려면 유효한 부 규칙이 1개 이상 필요합니다." };
  }

  return {
    ok: true,
    data: {
      verificationMode,
      verificationReviewRequired,
      eligibilityType,
      eligibilityValue,
      verificationGuideText,
      divisionEnabled,
      divisionMetricType,
      divisionRulesJson: divisionEnabled ? divisionRules : null,
    },
  };
}
