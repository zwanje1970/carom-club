/**
 * 커뮤니티 신뢰도 레벨·등급(티어) 시스템
 * 누적 점수 → 레벨 → 등급명·배지 색상
 */

/** 누적 점수 기준 레벨 임계값 (이상이면 해당 레벨) */
export const LEVEL_THRESHOLDS: number[] = [
  0, 20, 50, 100, 160, 240, 340, 460, 600, 760, 940, 1160, 1440, 1800, 2200,
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/** 레벨별 등급명 */
export const TIER_NAMES: Record<number, string> = {
  1: "입문",
  2: "입문",
  3: "일반",
  4: "일반",
  5: "활동",
  6: "활동",
  7: "숙련",
  8: "숙련",
  9: "고수",
  10: "고수",
  11: "실전고수",
  12: "실전고수",
  13: "해결사",
  14: "해결사",
  15: "마스터 해결사",
};

/** 등급별 배지/강조용 색상 (테마·배지에 사용) */
export const TIER_COLORS: Record<number, string> = {
  1: "#94a3b8", // 입문: 슬레이트
  2: "#94a3b8",
  3: "#64748b", // 일반: 스톤
  4: "#64748b",
  5: "#0ea5e9", // 활동: 스카이
  6: "#0ea5e9",
  7: "#8b5cf6", // 숙련: 바이올렛
  8: "#8b5cf6",
  9: "#f59e0b", // 고수: 앰버
  10: "#f59e0b",
  11: "#ef4444", // 실전고수: 레드
  12: "#ef4444",
  13: "#10b981", // 해결사: 에메랄드
  14: "#10b981",
  15: "#eab308", // 마스터 해결사: 골드
};

/**
 * 누적 점수로 레벨 계산 (1~15)
 */
export function getLevelFromScore(totalScore: number): number {
  if (totalScore < 0) return 1;
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalScore >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, MAX_LEVEL);
}

/**
 * 레벨에 해당하는 등급명
 */
export function getTierName(level: number): string {
  return TIER_NAMES[Math.min(Math.max(1, level), MAX_LEVEL)] ?? "입문";
}

/**
 * 레벨에 해당하는 배지 색상
 */
export function getTierColor(level: number): string {
  return TIER_COLORS[Math.min(Math.max(1, level), MAX_LEVEL)] ?? "#94a3b8";
}

/**
 * 레벨별 최소 권한 (명세: POST_CREATE, COMMENT_LIKE, NANGU_POST_CREATE, NANGU_SOLUTION_CREATE)
 */
export const MIN_LEVEL = {
  /** 일반 게시글 작성 */
  POST_CREATE: 1,
  /** 댓글 / 좋아요 */
  COMMENT_LIKE: 2,
  /** 당구해결사(난구) 문제 등록 (레벨 제한 없음 — 일반 글쓰기와 동일 기준) */
  NANGU_POST_CREATE: 1,
  /** 해법 등록 */
  NANGU_SOLUTION_CREATE: 4,
  /** 추가 기능 확장 */
  EXTENDED: 6,
  /** 고수 표시 강조 */
  EXPERT_DISPLAY: 10,
  /** 해결사 배지 강조 */
  SOLVER_BADGE: 13,
  // 호환용 별칭
  POST: 1,
  COMMENT_AND_LIKE: 2,
  NANGU_PROBLEM: 1,
  NANGU_SOLUTION: 4,
} as const;

export function canPost(level: number): boolean {
  return level >= MIN_LEVEL.POST_CREATE;
}
export function canCommentAndLike(level: number): boolean {
  return level >= MIN_LEVEL.COMMENT_LIKE;
}
export function canRegisterNanguProblem(level: number): boolean {
  return level >= MIN_LEVEL.NANGU_POST_CREATE;
}
export function canRegisterNanguSolution(level: number): boolean {
  return level >= MIN_LEVEL.NANGU_SOLUTION_CREATE;
}
