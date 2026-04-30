import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

export const SITE_LAYOUT_CONFIG_KV_KEY = PLATFORM_KV_KEYS.siteLayoutConfig;

export type SiteLayoutConfigReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type SiteLayoutConfigWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteLayoutConfigReadStrategy(): SiteLayoutConfigReadStrategy {
  /** 모듈 로드 시점 `NODE_ENV`에 묶이지 않도록 매 호출 평가(Next 빌드/워커 혼선 방지). */
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "production-defaults-only";
  return "local-json-file";
}

export function resolveSiteLayoutConfigWriteStrategy(): SiteLayoutConfigWriteStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "blocked";
  return "local-json-file";
}

const WRITE_BLOCKED_PREFIX = "SITE_LAYOUT_CONFIG_PERSISTENCE_UNAVAILABLE";

export function isSiteLayoutConfigWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwSiteLayoutConfigWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, site layout config can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}

export async function readSiteLayoutConfigRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_LAYOUT_CONFIG_KV_KEY);
}

export async function upsertSiteLayoutConfigToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_LAYOUT_CONFIG_KV_KEY, value);
}
