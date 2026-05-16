import { isTournamentPastAutoEndSchedule } from "../tournament-auto-end-schedule";
import { listAllTournamentsFirestore, revalidatePublicTournamentCache } from "./firestore-tournaments";
import {
  normalizeTournamentStatusBadge,
  reconcileTournamentPublishedCardsForTournamentId,
  syncActiveTournamentCardSnapshotStatusBadge,
} from "./platform-backing-store";
import { getSharedFirestoreDb } from "./firestore-users";

const TOURNAMENT_COLLECTION = "v3_tournaments";

/**
 * 종료일 다음날 06:00(KST) 경과 대회를 자동 종료 처리한다.
 * 메인 게시카드 비활성화는 reconcileTournamentPublishedCardsForTournamentId가 담당한다.
 */
export async function runTournamentAutoEndBatch(): Promise<{
  scanned: number;
  ended: number;
  skippedAlreadyEnded: number;
  errors: string[];
}> {
  const tournaments = await listAllTournamentsFirestore();
  const now = new Date();
  let ended = 0;
  let skippedAlreadyEnded = 0;
  const errors: string[] = [];

  const db = getSharedFirestoreDb();

  for (const t of tournaments) {
    if (t.status === "DELETED") continue;
    const badge = normalizeTournamentStatusBadge(t.statusBadge);
    if (badge === "종료") {
      skippedAlreadyEnded += 1;
      continue;
    }
    if (!isTournamentPastAutoEndSchedule(t, now)) continue;

    try {
      await db.collection(TOURNAMENT_COLLECTION).doc(t.id).set({ statusBadge: "종료" }, { merge: true });
      try {
        await syncActiveTournamentCardSnapshotStatusBadge(t.id);
      } catch (e) {
        console.warn("[tournament-auto-end] sync card status failed", t.id, e);
      }
      try {
        await reconcileTournamentPublishedCardsForTournamentId(t.id);
      } catch (e) {
        console.warn("[tournament-auto-end] reconcile published cards failed", t.id, e);
      }
      revalidatePublicTournamentCache(t.id);
      ended += 1;
    } catch (e) {
      errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (ended > 0) {
    try {
      const { rebuildSitePublicTournamentListSnapshots } = await import("./site-public-list-snapshots-kv");
      await rebuildSitePublicTournamentListSnapshots();
    } catch (e) {
      console.warn("[tournament-auto-end] rebuild list snapshots failed", e);
    }
  }

  return { scanned: tournaments.length, ended, skippedAlreadyEnded, errors };
}
