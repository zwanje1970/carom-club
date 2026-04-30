import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
/** `platform-tournament-published-cards-settings`와 동일: 비개발 런타임은 Firestore KV 우선(local-json-file 미사용). */
const IS_RUNTIME_DEPLOYMENT = !IS_DEVELOPMENT;

export const SITE_LAYOUT_CONFIG_KV_KEY = PLATFORM_KV_KEYS.siteLayoutConfig;

export type SiteLayoutConfigReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type SiteLayoutConfigWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteLayoutConfigReadStrategy(): SiteLayoutConfigReadStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "production-defaults-only";
  return "local-json-file";
}

export function resolveSiteLayoutConfigWriteStrategy(): SiteLayoutConfigWriteStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "blocked";
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
