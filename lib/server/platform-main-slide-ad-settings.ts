import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
/** `platform-tournament-published-cards-settings`와 동일: 비개발 런타임은 Firestore KV 우선. */
const IS_RUNTIME_DEPLOYMENT = !IS_DEVELOPMENT;

export const MAIN_SLIDE_ADS_KV_KEY = PLATFORM_KV_KEYS.mainSlideAds;
export const MAIN_SLIDE_AD_CONFIG_KV_KEY = PLATFORM_KV_KEYS.mainSlideAdConfig;

export type MainSlideAdSettingsReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type MainSlideAdSettingsWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveMainSlideAdSettingsReadStrategy(): MainSlideAdSettingsReadStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "production-defaults-only";
  return "local-json-file";
}

export function resolveMainSlideAdSettingsWriteStrategy(): MainSlideAdSettingsWriteStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "blocked";
  return "local-json-file";
}

export async function readMainSlideAdsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(MAIN_SLIDE_ADS_KV_KEY);
}

export async function readMainSlideAdConfigRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(MAIN_SLIDE_AD_CONFIG_KV_KEY);
}

export async function upsertMainSlideAdsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(MAIN_SLIDE_ADS_KV_KEY, value);
}

export async function upsertMainSlideAdConfigToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(MAIN_SLIDE_AD_CONFIG_KV_KEY, value);
}

const WRITE_BLOCKED_PREFIX = "MAIN_SLIDE_AD_SETTINGS_PERSISTENCE_UNAVAILABLE";

export function isMainSlideAdSettingsWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwMainSlideAdSettingsWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, main slide ad settings can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}
