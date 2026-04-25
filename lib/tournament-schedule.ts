import type { Tournament } from "./types/entities";

const KO_WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

function appendKoreanWeekday(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return trimmed;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  const core = m ? m[1]! : trimmed;
  const d = new Date(`${core}T12:00:00`);
  if (Number.isNaN(d.getTime())) return trimmed;
  return `${core} (${KO_WEEKDAY_SHORT[d.getDay()]})`;
}

/** 일정 표시: 연속이면 `시작 ~ 종료`, 아니면 쉼표 구분 */
export function formatTournamentScheduleLabel(tournament: Pick<Tournament, "date" | "eventDates">): string {
  const dates =
    tournament.eventDates && tournament.eventDates.length > 0
      ? [...tournament.eventDates]
      : tournament.date
        ? [tournament.date]
        : [];
  const sorted = dates.map((d) => d.trim()).filter(Boolean).sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return appendKoreanWeekday(sorted[0]!);
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]! + "T12:00:00");
    const b = new Date(sorted[i]! + "T12:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || (b.getTime() - a.getTime()) / 86400000 !== 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) {
    return `${appendKoreanWeekday(sorted[0]!)} ~ ${appendKoreanWeekday(sorted[sorted.length - 1]!)}`;
  }
  return sorted.map(appendKoreanWeekday).join(", ");
}
