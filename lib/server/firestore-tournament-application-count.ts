import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { getSharedFirestoreDb } from "./firestore-users";

const COLLECTION = "v3_tournament_applications";

/** 신청 1건이라도 있는지 여부만 확인 — count 집계 1회 */
export async function hasAnyTournamentApplicationForTournamentFirestore(tournamentId: string): Promise<boolean> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return false;
  const db = getSharedFirestoreDb();
  const snap = await db.collection(COLLECTION).where("tournamentId", "==", id).count().get();
  return snap.data().count > 0;
}
