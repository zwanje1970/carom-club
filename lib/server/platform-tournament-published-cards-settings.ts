import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const TOURNAMENT_PUBLISHED_CARDS_KV_KEY = PLATFORM_KV_KEYS.tournamentPublishedCards;

export type TournamentPublishedCardsReadStrategy = "firestore-kv" | "dev-store-file" | "production-defaults-only";

export type TournamentPublishedCardsWriteStrategy = "firestore-kv" | "dev-store-file" | "blocked";

export function resolveTournamentPublishedCardsReadStrategy(): TournamentPublishedCardsReadStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "production-defaults-only";
  return "dev-store-file";
}

export function resolveTournamentPublishedCardsWriteStrategy(): TournamentPublishedCardsWriteStrategy {
  if (IS_PRODUCTION && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (IS_PRODUCTION) return "blocked";
  return "dev-store-file";
}

const WRITE_BLOCKED_PREFIX = "TOURNAMENT_PUBLISHED_CARDS_PERSISTENCE_UNAVAILABLE";

export function isTournamentPublishedCardsWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwTournamentPublishedCardsWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, tournament published cards can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based dev-store persistence is disabled in production."
  );
}

export async function readTournamentPublishedCardsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(TOURNAMENT_PUBLISHED_CARDS_KV_KEY);
}

export async function upsertTournamentPublishedCardsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(TOURNAMENT_PUBLISHED_CARDS_KV_KEY, value);
}
