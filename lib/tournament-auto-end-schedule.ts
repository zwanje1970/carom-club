import type { Tournament } from "./types/entities";
import { addDaysYyyyMmDd } from "./server/tournament-auto-push-text";

function yyyyMmDdPrefixFromScheduleField(s: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((s ?? "").trim());
  return m ? m[1]! : null;
}

/** 대회 일정의 마지막 달력일(YYYY-MM-DD). */
export function resolveTournamentLastScheduleDayYyyyMmDd(
  t: Pick<Tournament, "date" | "eventDates">,
): string | null {
  const ev =
    t.eventDates && t.eventDates.length > 0
      ? [...t.eventDates].map((x) => x.trim()).filter(Boolean).sort()
      : [];
  if (ev.length > 0) return yyyyMmDdPrefixFromScheduleField(ev[ev.length - 1]!);
  return yyyyMmDdPrefixFromScheduleField(typeof t.date === "string" ? t.date : "");
}

/**
 * 종료일 다음날 오전 6:00(Asia/Seoul) 이후인지 판단.
 * 예: 종료일 2026-05-15 → 2026-05-16 06:00 KST 이후 true.
 */
export function isPastTournamentAutoEndThreshold(lastScheduleDayYyyyMmDd: string, now = new Date()): boolean {
  const last = (lastScheduleDayYyyyMmDd ?? "").trim();
  if (!last) return false;
  const autoEndDay = addDaysYyyyMmDd(last, 1);
  if (!autoEndDay) return false;
  const thresholdMs = Date.parse(`${autoEndDay}T06:00:00+09:00`);
  if (!Number.isFinite(thresholdMs)) return false;
  return now.getTime() >= thresholdMs;
}

export function isTournamentPastAutoEndSchedule(
  t: Pick<Tournament, "date" | "eventDates">,
  now = new Date(),
): boolean {
  const last = resolveTournamentLastScheduleDayYyyyMmDd(t);
  if (!last) return false;
  return isPastTournamentAutoEndThreshold(last, now);
}
