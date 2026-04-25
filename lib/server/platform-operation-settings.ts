import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const PLATFORM_OPERATION_SETTINGS_KV_KEY = PLATFORM_KV_KEYS.platformOperationSettings;

export type PlatformOperationSettingsReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type PlatformOperationSettingsWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolvePlatformOperationSettingsReadStrategy(): PlatformOperationSettingsReadStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "production-defaults-only";
  return "local-json-file";
}

export function resolvePlatformOperationSettingsWriteStrategy(): PlatformOperationSettingsWriteStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "blocked";
  return "local-json-file";
}

const WRITE_BLOCKED_PREFIX = "PLATFORM_OPERATION_SETTINGS_PERSISTENCE_UNAVAILABLE";

export function isPlatformOperationSettingsWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwPlatformOperationSettingsWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, platform operation settings can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}

export async function readPlatformOperationSettingsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(PLATFORM_OPERATION_SETTINGS_KV_KEY);
}

export async function upsertPlatformOperationSettingsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(PLATFORM_OPERATION_SETTINGS_KV_KEY, value);
}
