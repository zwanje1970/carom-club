import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
/** `platform-tournament-published-cards-settings`와 동일: 비개발 런타임은 Firestore KV 우선. */
const IS_RUNTIME_DEPLOYMENT = !IS_DEVELOPMENT;

export const SITE_PROOF_IMAGE_ASSETS_KV_KEY = PLATFORM_KV_KEYS.siteProofImageAssets;

export type SiteProofImageAssetsReadStrategy = "firestore-kv" | "local-json-file" | "production-empty-only";

export type SiteProofImageAssetsWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteProofImageAssetsReadStrategy(): SiteProofImageAssetsReadStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "production-empty-only";
  return "local-json-file";
}

export function resolveSiteProofImageAssetsWriteStrategy(): SiteProofImageAssetsWriteStrategy {
  if (IS_RUNTIME_DEPLOYMENT && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_RUNTIME_DEPLOYMENT) return "blocked";
  return "local-json-file";
}

export async function readSiteProofImageAssetsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_PROOF_IMAGE_ASSETS_KV_KEY);
}

export async function upsertSiteProofImageAssetsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_PROOF_IMAGE_ASSETS_KV_KEY, value);
}
