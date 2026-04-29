/**
 * 고아 게시카드 정리: `pruneOrphanTournamentPublishedCards()` 실행 후 요약 출력.
 * Firestore 모드면 대회 목록·KV 게시카드에 접근(앱과 동일 env). 로컬 JSON이면 dev 스토어 파일 기준.
 *
 *   npx --yes tsx scripts/prune-orphan-published-cards.mts
 */
const { pruneOrphanTournamentPublishedCards } = await import("../lib/server/platform-backing-store");

const r = await pruneOrphanTournamentPublishedCards();
const allDeleted = [...r.deletedPublishedCardSnapshotIds, ...r.deletedLegacySnapshotIds];

console.log("[prune-orphan-published-cards] reconcileChangedRowCount:", r.reconcileChangedRowCount);
console.log("[prune-orphan-published-cards] tournamentCount:", r.tournamentCount);
console.log("[prune-orphan-published-cards] deletedPublishedCardSnapshotIds count:", r.deletedPublishedCardSnapshotIds.length);
console.log("[prune-orphan-published-cards] deletedLegacySnapshotIds count:", r.deletedLegacySnapshotIds.length);
console.log("[prune-orphan-published-cards] remainingPublishedCardsCount:", r.remainingPublishedCardsCount);
console.log("[prune-orphan-published-cards] all deleted snapshot ids:", JSON.stringify(allDeleted));
