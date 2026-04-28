/**
 * 메인 슬라이드·게시 스냅샷의 카드 부제목(일시 · 장소) 규칙.
 * `platform-backing-store`의 `tournamentPublishedCardToPublishedSnapshot`와 동일해야 한다.
 */

const KO_WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** `YYYY-MM-DD`… 앞부분만 사용해 `(월)` 형 요일 부착 — 파싱 실패 시 원문 유지 */
export function appendKoreanWeekdayToDateDisplay(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return trimmed;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  const core = m ? m[1]! : trimmed;
  const d = new Date(`${core}T12:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return `${core} (${KO_WEEKDAY_SHORT[d.getDay()]})`;
}

export function buildTournamentPublishedCardSubtitle(params: {
  cardDisplayDate: string;
  cardDisplayLocation: string;
  tournamentDate: string;
  tournamentLocation: string;
}): string {
  const storedDate = params.cardDisplayDate.trim();
  const storedLoc = params.cardDisplayLocation.trim();
  const fbDate = params.tournamentDate.trim();
  const fbLoc = params.tournamentLocation.trim();
  const datePart = appendKoreanWeekdayToDateDisplay(storedDate || fbDate);
  const locPart = storedLoc || fbLoc;
  return [datePart, locPart].filter((x) => x.length > 0).join(" · ");
}
