import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

export const SITE_COMMUNITY_FEED_KV_KEY = PLATFORM_KV_KEYS.siteCommunityFeed;

export type SiteCommunityFeedReadStrategy = "firestore-kv" | "local-json-file" | "production-empty-only";

export type SiteCommunityFeedWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveSiteCommunityFeedReadStrategy(): SiteCommunityFeedReadStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "production-empty-only";
  return "local-json-file";
}

export function resolveSiteCommunityFeedWriteStrategy(): SiteCommunityFeedWriteStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "blocked";
  return "local-json-file";
}

export async function readSiteCommunityFeedRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_COMMUNITY_FEED_KV_KEY);
}

export async function upsertSiteCommunityFeedToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_COMMUNITY_FEED_KV_KEY, value);
}
