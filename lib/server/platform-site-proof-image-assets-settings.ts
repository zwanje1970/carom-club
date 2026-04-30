import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

export const SITE_PROOF_IMAGE_ASSETS_KV_KEY = PLATFORM_KV_KEYS.siteProofImageAssets;

export type SiteProofImageAssetsReadStrategy = "firestore-kv" | "local-json-file" | "production-empty-only";

export type SiteProofImageAssetsWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteProofImageAssetsReadStrategy(): SiteProofImageAssetsReadStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "production-empty-only";
  return "local-json-file";
}

export function resolveSiteProofImageAssetsWriteStrategy(): SiteProofImageAssetsWriteStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "blocked";
  return "local-json-file";
}

export async function readSiteProofImageAssetsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_PROOF_IMAGE_ASSETS_KV_KEY);
}

export async function upsertSiteProofImageAssetsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_PROOF_IMAGE_ASSETS_KV_KEY, value);
}
