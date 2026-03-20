/**
 * 서버/클라이언트 동일 출력을 위한 날짜 포맷 (hydration 안전).
 * timeZone "Asia/Seoul" 명시로 환경별 차이 제거.
 */

const KO_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Seoul",
});

const KO_DATE_ONLY = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

const KO_DATE_SHORT = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export function formatKoreanDateTime(v: string | number | Date): string {
  return KO_DATE_TIME.format(new Date(v));
}

export function formatKoreanDate(v: string | number | Date): string {
  return KO_DATE_ONLY.format(new Date(v));
}

/** month short + day + time (예: 참가 신청/입금 표시) */
export function formatKoreanDateShort(v: string | number | Date): string {
  return KO_DATE_SHORT.format(new Date(v));
}

const KO_SCHEDULE_DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul",
});
const KO_SCHEDULE_TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

/** 일정 표시: "3월 18일 (수) 14:00" 형식 */
export function formatKoreanSchedule(startAt: string | number | Date, endAt?: string | number | Date | null): string {
  const s = new Date(startAt);
  const e = endAt != null ? new Date(endAt) : null;
  const fmt = (d: Date) => `${KO_SCHEDULE_DATE.format(d)} ${KO_SCHEDULE_TIME.format(d)}`;
  return e ? `${fmt(s)} ~ ${fmt(e)}` : fmt(s);
}

/** 날짜+요일만 (예: "2025년 3월 18일 (화)"). timeZone 고정으로 SSR/CSR 동일. */
export function formatKoreanDateWithWeekday(v: string | number | Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(v));
}

/** 게시판 리스트용 짧은 날짜 (예: 03.19) — timeZone 고정 */
export function formatCommunityListDate(v: string | number | Date): string {
  const d = new Date(v);
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(d);
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${m}.${day}`;
}
