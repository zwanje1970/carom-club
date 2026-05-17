/** 세로·가로(표) 신청자 화면 간 삭제 ID 공유 — 페이지 전환 시 컴ponent remount 대응 */
const deletedEntryIdsByTournament = new Map<string, Set<string>>();

export function getSharedDeletedEntryIds(tournamentId: string): Set<string> {
  const id = tournamentId.trim();
  let set = deletedEntryIdsByTournament.get(id);
  if (!set) {
    set = new Set();
    deletedEntryIdsByTournament.set(id, set);
  }
  return set;
}
