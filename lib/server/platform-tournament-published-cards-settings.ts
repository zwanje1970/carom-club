import { isEntityLifecycleVisibleForList } from "./entity-lifecycle";
import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import { PLATFORM_KV_KEYS, readPlatformKvJson, upsertPlatformKvJson } from "./platform-kv-firestore";

export const TOURNAMENT_PUBLISHED_CARDS_KV_KEY = PLATFORM_KV_KEYS.tournamentPublishedCards;

export type TournamentPublishedCardsReadStrategy = "firestore-kv" | "local-json-file" | "production-defaults-only";

export type TournamentPublishedCardsWriteStrategy = "firestore-kv" | "local-json-file" | "blocked";

export function resolveTournamentPublishedCardsReadStrategy(): TournamentPublishedCardsReadStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "production-defaults-only";
  return "local-json-file";
}

export function resolveTournamentPublishedCardsWriteStrategy(): TournamentPublishedCardsWriteStrategy {
  const isDeploymentRuntime = process.env.NODE_ENV !== "development";
  if (isDeploymentRuntime && isFirestoreUsersBackendConfigured()) return "firestore-kv";
  if (isDeploymentRuntime) return "blocked";
  return "local-json-file";
}

const WRITE_BLOCKED_PREFIX = "TOURNAMENT_PUBLISHED_CARDS_PERSISTENCE_UNAVAILABLE";

export function isTournamentPublishedCardsWritePersistenceBlockedError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(WRITE_BLOCKED_PREFIX);
}

export function throwTournamentPublishedCardsWritePersistenceBlocked(): never {
  throw new Error(
    `${WRITE_BLOCKED_PREFIX}: In production, tournament published cards can only be saved to Firestore. ` +
      "Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY. " +
      "File-based local JSON persistence is disabled in production."
  );
}

export async function readTournamentPublishedCardsRawFromFirestoreKv(): Promise<unknown | null> {
  return readPlatformKvJson(TOURNAMENT_PUBLISHED_CARDS_KV_KEY);
}

/** 정산 ledger-overview 등: Firestore KV만 읽음(로컬 JSON 파일 미사용). */
export async function listPublishedCardFlagsFromFirestoreKv(): Promise<
  Array<{ tournamentId: string; isPublished: boolean; isActive: boolean }>
> {
  if (!isFirestoreUsersBackendConfigured()) return [];
  try {
    const raw = await readTournamentPublishedCardsRawFromFirestoreKv();
    if (raw == null || !Array.isArray(raw)) return [];
    const out: Array<{ tournamentId: string; isPublished: boolean; isActive: boolean }> = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const tournamentId = typeof r.tournamentId === "string" ? r.tournamentId.trim() : "";
      if (!tournamentId) continue;
      if (!isEntityLifecycleVisibleForList(r.lifecycleStatus)) continue;
      const isPublished = typeof r.isPublished === "boolean" ? r.isPublished : true;
      const isActive = typeof r.isActive === "boolean" ? r.isActive : false;
      out.push({ tournamentId, isPublished, isActive });
    }
    return out;
  } catch {
    return [];
  }
}

export async function upsertTournamentPublishedCardsToFirestoreKv(value: unknown): Promise<void> {
  return upsertPlatformKvJson(TOURNAMENT_PUBLISHED_CARDS_KV_KEY, value);
}

/** 정산 장부 게이트: 게시·활성 카드가 KV에 있을 때만 true. */
export async function tournamentHasActivePublishedCardInKv(tournamentId: string): Promise<boolean> {
  const id = tournamentId.trim();
  if (!id) return false;
  const cards = await listPublishedCardFlagsFromFirestoreKv();
  return cards.some((c) => c.tournamentId === id && c.isPublished === true && c.isActive === true);
}
