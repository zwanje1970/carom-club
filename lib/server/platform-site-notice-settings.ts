import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
/** `platform-tournament-published-cards-settings`와 동일: 비개발 런타임은 Firestore KV 우선. */
const IS_RUNTIME_DEPLOYMENT = !IS_DEVELOPMENT;

/** 다음 단계에서 다른 설정 키와 동일 패턴으로 확장할 때 참고용 */
export const SITE_NOTICE_KV_KEY = PLATFORM_KV_KEYS.siteNotice;

export type SiteNoticeReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type SiteNoticeWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

/** 운영에서 siteNotice를 Firestore KV로 읽을지(레이아웃·커뮤니티 설정과 동일 분기) */
export function resolveSiteNoticeReadStrategy(): SiteNoticeReadStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "production-defaults-only";
  return "local-json-file";
}

/** 운영에서 siteNotice를 Firestore KV로 쓸지(운영+자격 없음이면 차단) */
export function resolveSiteNoticeWriteStrategy(): SiteNoticeWriteStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "blocked";
  return "local-json-file";
}

const WRITE_BLOCKED_PREFIX = "SITE_NOTICE_PERSISTENCE_UNAVAILABLE";

export function isSiteNoticeWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwSiteNoticeWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, site notice can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}

export async function readSiteNoticeRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_NOTICE_KV_KEY);
}

export async function upsertSiteNoticeToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_NOTICE_KV_KEY, value);
}
