import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const SITE_COMMUNITY_FEED_KV_KEY = PLATFORM_KV_KEYS.siteCommunityFeed;

export type SiteCommunityFeedReadStrategy = "firestore-kv" | "dev-store-file" | "production-empty-only";

export type SiteCommunityFeedWriteStrategy = "firestore-kv" | "dev-store-file" | "blocked";

export function resolveSiteCommunityFeedReadStrategy(): SiteCommunityFeedReadStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "production-empty-only";
  return "dev-store-file";
}

export function resolveSiteCommunityFeedWriteStrategy(): SiteCommunityFeedWriteStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "blocked";
  return "dev-store-file";
}

export async function readSiteCommunityFeedRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(SITE_COMMUNITY_FEED_KV_KEY);
}

export async function upsertSiteCommunityFeedToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(SITE_COMMUNITY_FEED_KV_KEY, value);
}
