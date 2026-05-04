import type { TournamentRuleSnapshot } from "./platform-backing-store";

export type OcrEligibilityParsed = {
  name: string | null;
  phone: string | null;
  score: number | null;
  average: number | null;
};

export type OcrEligibilityCheckResult = {
  target: "NONE" | "SCORE" | "EVER" | "BOTH" | "UNKNOWN";
  extractedValue: number | null;
  limit: number | null;
  compare: "LTE" | "LT" | null;
  passed: boolean | null;
  message: string;
};

const PHONE_RE = /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/;

function trimLine(s: string): string {
  return s.replace(/\u00a0/g, " ").trim();
}

function parseNumberFlexible(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * 증빙 OCR 텍스트에서 이름·전화·핸디(점수)·에버(평균) 후보를 느슨하게 추출한다.
 * 관리자 참고용이며 법적/자동 승인 근거로 쓰이지 않는다.
 */
export function parseOcrEligibilityText(rawText: string): OcrEligibilityParsed {
  const text = (rawText ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) {
    return { name: null, phone: null, score: null, average: null };
  }

  let name: string | null = null;
  const nameM = text.match(
    /(?:이름|성명|신청자)\s*[:：]?\s*(?:\n\s*)?([^\n\r]+)/i
  );
  if (nameM?.[1]) {
    name = trimLine(nameM[1]).split(/\s{2,}|\t/)[0] ?? null;
    if (name === "") name = null;
  }

  let phone: string | null = null;
  const phoneM = text.match(PHONE_RE);
  if (phoneM?.[0]) {
    phone = phoneM[0].replace(/\s/g, "");
  }

  let score: number | null = null;
  const handiM = text.match(
    /(?:핸디|점수)\s*[:：]?\s*(?:\r?\n\s*)?([\d.,]+)\s*점?/i
  );
  if (handiM?.[1]) {
    score = parseNumberFlexible(handiM[1]);
  }
  if (score == null) {
    const ptM = text.match(/(\d+)\s*점(?!\d)/);
    if (ptM?.[1]) score = Number.parseInt(ptM[1], 10);
  }

  let average: number | null = null;
  const avgLabelM = text.match(
    /(?:애버리지|에버리지|에버|AVG|average)\s*[:：]?\s*(?:\r?\n\s*)?([\d.,]+)/i
  );
  if (avgLabelM?.[1]) {
    average = parseNumberFlexible(avgLabelM[1]);
  }
  if (average == null) {
    const decM = text.match(/\b(\d+[.,]\d{2,})\b/);
    if (decM?.[1]) average = parseNumberFlexible(decM[1]);
  }

  return { name, phone, score, average };
}

function compareValue(value: number, limit: number, compare: "LTE" | "LT"): boolean {
  return compare === "LT" ? value < limit : value <= limit;
}

/**
 * 대회 규칙 스냅샷 기준 참고 판정. 자동 승인/거절에 사용하지 않는다.
 */
export function checkOcrEligibility(
  parsed: OcrEligibilityParsed,
  tournamentRule: TournamentRuleSnapshot
): OcrEligibilityCheckResult {
  const eq = tournamentRule.entryQualificationType;
  const limit =
    tournamentRule.eligibilityValue != null && Number.isFinite(tournamentRule.eligibilityValue)
      ? tournamentRule.eligibilityValue
      : null;
  const compare: "LTE" | "LT" =
    tournamentRule.eligibilityCompare === "LT" ? "LT" : "LTE";

  if (eq === "NONE") {
    return {
      target: "NONE",
      extractedValue: null,
      limit,
      compare: null,
      passed: null,
      message: "대회 참가 자격 제한이 없어 OCR 수치 비교는 하지 않습니다.",
    };
  }

  if (limit == null) {
    return {
      target: eq,
      extractedValue: null,
      limit: null,
      compare,
      passed: null,
      message: "대회에 참가 자격 기준값이 없어 OCR과 비교할 수 없습니다.",
    };
  }

  if (eq === "SCORE") {
    if (parsed.score == null) {
      return {
        target: "SCORE",
        extractedValue: null,
        limit,
        compare,
        passed: null,
        message: "OCR 텍스트에서 핸디(점수)를 찾지 못했습니다.",
      };
    }
    const passed = compareValue(parsed.score, limit, compare);
    return {
      target: "SCORE",
      extractedValue: parsed.score,
      limit,
      compare,
      passed,
      message: passed
        ? `OCR 핸디 ${parsed.score}점은 기준 ${limit}점 ${compare === "LT" ? "미만" : "이하"} 조건을 만족합니다(참고).`
        : `OCR 핸디 ${parsed.score}점은 기준 ${limit}점 ${compare === "LT" ? "미만" : "이하"} 조건을 만족하지 않을 수 있습니다(참고).`,
    };
  }

  if (eq === "EVER") {
    if (parsed.average == null) {
      return {
        target: "EVER",
        extractedValue: null,
        limit,
        compare,
        passed: null,
        message: "OCR 텍스트에서 애버리지(에버)를 찾지 못했습니다.",
      };
    }
    const passed = compareValue(parsed.average, limit, compare);
    return {
      target: "EVER",
      extractedValue: parsed.average,
      limit,
      compare,
      passed,
      message: passed
        ? `OCR 애버리지 ${parsed.average}는 기준 ${limit} ${compare === "LT" ? "미만" : "이하"} 조건을 만족합니다(참고).`
        : `OCR 애버리지 ${parsed.average}는 기준 ${limit} ${compare === "LT" ? "미만" : "이하"} 조건을 만족하지 않을 수 있습니다(참고).`,
    };
  }

  if (eq === "BOTH") {
    const sOk = parsed.score != null;
    const aOk = parsed.average != null;
    if (!sOk && !aOk) {
      return {
        target: "BOTH",
        extractedValue: null,
        limit,
        compare,
        passed: null,
        message: "OCR 텍스트에서 점수·애버리지를 모두 찾지 못했습니다.",
      };
    }
    const parts: string[] = [];
    let scorePass: boolean | null = null;
    let avgPass: boolean | null = null;
    if (sOk && parsed.score != null) {
      scorePass = compareValue(parsed.score, limit, compare);
      parts.push(
        `점수 ${parsed.score}점 → ${scorePass ? "기준 충족(참고)" : "기준 미충족 가능(참고)"}`
      );
    } else {
      parts.push("점수 미추출");
    }
    if (aOk && parsed.average != null) {
      avgPass = compareValue(parsed.average, limit, compare);
      parts.push(
        `애버리지 ${parsed.average} → ${avgPass ? "기준 충족(참고)" : "기준 미충족 가능(참고)"}`
      );
    } else {
      parts.push("애버리지 미추출");
    }
    const passed =
      scorePass === true && avgPass === true
        ? true
        : scorePass === false || avgPass === false
          ? false
          : null;
    return {
      target: "BOTH",
      extractedValue: null,
      limit,
      compare,
      passed,
      message: `BOTH 자격: 동일 기준 ${limit} (${compare === "LT" ? "미만" : "이하"}) — ${parts.join(" / ")}`,
    };
  }

  return {
    target: "UNKNOWN",
    extractedValue: null,
    limit,
    compare,
    passed: null,
    message: `알 수 없는 참가 자격 유형(${String(eq)})으로 OCR 비교를 건너뜁니다.`,
  };
}
