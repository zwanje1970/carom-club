import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const SITE_LAYOUT_CONFIG_KV_KEY = PLATFORM_KV_KEYS.siteLayoutConfig;

export type SiteLayoutConfigReadStrategy = "firestore-kv" | "dev-store-file" | "production-defaults-only";

export type SiteLayoutConfigWriteStrategy = "firestore-kv" | "dev-store-file" | "blocked";

export function resolveSiteLayoutConfigReadStrategy(): SiteLayoutConfigReadStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "production-defaults-only";
  return "dev-store-file";
}

export function resolveSiteLayoutConfigWriteStrategy(): SiteLayoutConfigWriteStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "blocked";
  return "dev-store-file";
}

const WRITE_BLOCKED_PREFIX = "SITE_LAYOUT_CONFIG_PERSISTENCE_UNAVAILABLE";

export function isSiteLayoutConfigWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwSiteLayoutConfigWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, site layout config can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based dev-store persistence is disabled in production."
  );
}

export async function readSiteLayoutConfigRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_LAYOUT_CONFIG_KV_KEY);
}

export async function upsertSiteLayoutConfigToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_LAYOUT_CONFIG_KV_KEY, value);
}
