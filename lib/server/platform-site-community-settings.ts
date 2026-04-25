import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const SITE_COMMUNITY_CONFIG_KV_KEY = PLATFORM_KV_KEYS.siteCommunityConfig;

export type SiteCommunityConfigReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type SiteCommunityConfigWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteCommunityConfigReadStrategy(): SiteCommunityConfigReadStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "production-defaults-only";
  return "local-json-file";
}

export function resolveSiteCommunityConfigWriteStrategy(): SiteCommunityConfigWriteStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "blocked";
  return "local-json-file";
}

const WRITE_BLOCKED_PREFIX = "SITE_COMMUNITY_CONFIG_PERSISTENCE_UNAVAILABLE";

export function isSiteCommunityConfigWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwSiteCommunityConfigWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, site community config can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}

export async function readSiteCommunityConfigRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_COMMUNITY_CONFIG_KV_KEY);
}

export async function upsertSiteCommunityConfigToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_COMMUNITY_CONFIG_KV_KEY, value);
}
