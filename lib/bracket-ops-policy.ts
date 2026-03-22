/**
 * 대진 운영 정책 — TournamentRule.bracketConfig JSON 확장 필드.
 * allowBracketCompletedResultEdit: false 이면 COMPLETED 경기의 승자·점수·선수 슬롯·상태 변경 불가(운영 잠금).
 */

export type BracketOpsPolicy = {
  allowBracketCompletedResultEdit: boolean;
};

export function parseBracketOpsPolicy(bracketConfig: string | object | null | undefined): BracketOpsPolicy {
  let raw: Record<string, unknown> = {};
  if (bracketConfig == null) {
    raw = {};
  } else if (typeof bracketConfig === "string") {
    try {
      raw = bracketConfig ? (JSON.parse(bracketConfig) as Record<string, unknown>) : {};
    } catch {
      raw = {};
    }
  } else {
    raw = bracketConfig as Record<string, unknown>;
  }
  const allow = raw.allowBracketCompletedResultEdit;
  return {
    allowBracketCompletedResultEdit: allow !== false,
  };
}
