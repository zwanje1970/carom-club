import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export const FEATURE_KEYS = [
  "signup_enabled",
  "tournament_create_enabled",
  "tournament_apply_enabled",
  "community_write_enabled",
  "community_comment_enabled",
  "lesson_apply_enabled",
] as const;

export type SiteFeatureKey = (typeof FEATURE_KEYS)[number];

const LABELS: Record<SiteFeatureKey, string> = {
  signup_enabled: "회원가입 ON/OFF",
  tournament_create_enabled: "대회 생성 ON/OFF",
  tournament_apply_enabled: "대회 참가 신청 ON/OFF",
  community_write_enabled: "커뮤니티 글쓰기 ON/OFF",
  community_comment_enabled: "댓글 ON/OFF",
  lesson_apply_enabled: "레슨 신청 ON/OFF",
};

export function getFeatureLabel(key: SiteFeatureKey): string {
  return LABELS[key] ?? key;
}

let cache: Record<string, boolean> | null = null;

/** 단일 기능 활성화 여부 (캐시 1분) */
export async function isFeatureEnabled(key: SiteFeatureKey): Promise<boolean> {
  if (!isDatabaseConfigured()) return true;
  try {
    const row = await prisma.siteFeatureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });
    return row?.enabled ?? true;
  } catch {
    return true;
  }
}

/** 전체 플래그 맵 (관리자용) */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  if (!isDatabaseConfigured()) {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
  }
  try {
    const rows = await prisma.siteFeatureFlag.findMany({
      where: { key: { in: [...FEATURE_KEYS] } },
      select: { key: true, enabled: true },
    });
    const map: Record<string, boolean> = {};
    for (const k of FEATURE_KEYS) {
      map[k] = rows.find((r) => r.key === k)?.enabled ?? true;
    }
    return map;
  } catch {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
  }
}

/** 플래그 설정 (없으면 생성) */
export async function setFeatureFlag(key: SiteFeatureKey, enabled: boolean): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await prisma.siteFeatureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
  cache = null;
}
