import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export const FEATURE_KEYS = [
  "signup_enabled",
  "tournament_create_enabled",
  "tournament_apply_enabled",
  "community_write_enabled",
  "community_comment_enabled",
  "lesson_apply_enabled",
  "annual_membership_visible",
  "annual_membership_enforced",
] as const;

export type SiteFeatureKey = (typeof FEATURE_KEYS)[number];

const LABELS: Record<SiteFeatureKey, string> = {
  signup_enabled: "회원가입 ON/OFF",
  tournament_create_enabled: "대회 생성 ON/OFF",
  tournament_apply_enabled: "대회 참가 신청 ON/OFF",
  community_write_enabled: "커뮤니티 글쓰기 ON/OFF",
  community_comment_enabled: "댓글 ON/OFF",
  lesson_apply_enabled: "레슨 신청 ON/OFF",
  annual_membership_visible: "연회원 노출 ON/OFF",
  annual_membership_enforced: "연회원 기능 제한 ON/OFF",
};

export function getFeatureLabel(key: SiteFeatureKey): string {
  return LABELS[key] ?? key;
}

const DEFAULT_FLAG_VALUES: Record<SiteFeatureKey, boolean> = {
  signup_enabled: true,
  tournament_create_enabled: true,
  tournament_apply_enabled: true,
  community_write_enabled: true,
  community_comment_enabled: true,
  lesson_apply_enabled: true,
  annual_membership_visible: false,
  annual_membership_enforced: false,
};

/** 단일 기능 활성화 여부 (캐시 1분) */
export async function isFeatureEnabled(key: SiteFeatureKey): Promise<boolean> {
  if (!isDatabaseConfigured()) return DEFAULT_FLAG_VALUES[key];
  try {
    const row = await prisma.siteFeatureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });
    return row?.enabled ?? DEFAULT_FLAG_VALUES[key];
  } catch {
    return DEFAULT_FLAG_VALUES[key];
  }
}

/** 전체 플래그 맵 (관리자용) */
export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  if (!isDatabaseConfigured()) {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, DEFAULT_FLAG_VALUES[k]]));
  }
  try {
    const rows = await prisma.siteFeatureFlag.findMany({
      where: { key: { in: [...FEATURE_KEYS] } },
      select: { key: true, enabled: true },
    });
    const map: Record<string, boolean> = {};
    for (const k of FEATURE_KEYS) {
      map[k] = rows.find((r) => r.key === k)?.enabled ?? DEFAULT_FLAG_VALUES[k];
    }
    return map;
  } catch {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, DEFAULT_FLAG_VALUES[k]]));
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
}

export async function isAnnualMembershipVisible(): Promise<boolean> {
  return isFeatureEnabled("annual_membership_visible");
}

export async function isAnnualMembershipEnforced(): Promise<boolean> {
  return isFeatureEnabled("annual_membership_enforced");
}
