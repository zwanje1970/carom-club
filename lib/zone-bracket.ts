/**
 * 12B: 권역별 토너먼트 브래킷 생성.
 * build1v1Bracket로 1라운드 매치를 만들고, 상위 라운드 빈 슬롯과 nextMatch/nextSlot 연결.
 */
import { build1v1Bracket } from "@/modules/bracket-engine/tournament-bracket";
import type { ParticipantId } from "@/modules/bracket-engine/types";

export type ZoneMatchCreate = {
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  status: "PENDING" | "BYE";
  nextMatchId: string | null;
  nextSlot: "A" | "B" | null;
};

/**
 * 권역 배정된 참가자(entry id)로 1v1 싱글 엘리미네이션 브래킷 구조 생성.
 * 반환: 모든 라운드의 매치 생성용 데이터. nextMatchId/nextSlot은 id 부여 후 채움.
 */
export function buildZoneBracket(entryIds: ParticipantId[]): ZoneMatchCreate[] {
  if (entryIds.length < 2) return [];

  const round0Matches = build1v1Bracket(entryIds);
  const n = entryIds.length;
  let size = 1;
  while (size < n) size *= 2;
  const totalRounds = Math.round(Math.log2(size));
  const result: ZoneMatchCreate[] = [];

  // Round 0: build1v1Bracket 결과
  for (const m of round0Matches) {
    const a = m.participantIds[0] ?? null;
    const b = m.participantIds[1] ?? null;
    const isBye = a == null || b == null;
    result.push({
      roundIndex: 0,
      matchIndex: m.matchIndex,
      entryIdA: a,
      entryIdB: b,
      status: isBye ? "BYE" : "PENDING",
      nextMatchId: null,
      nextSlot: null,
    });
  }

  // Round 1 .. totalRounds-1: 빈 슬롯
  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = size / Math.pow(2, r + 1);
    for (let i = 0; i < matchesInRound; i++) {
      result.push({
        roundIndex: r,
        matchIndex: i,
        entryIdA: null,
        entryIdB: null,
        status: "PENDING",
        nextMatchId: null,
        nextSlot: null,
      });
    }
  }

  return result;
}

