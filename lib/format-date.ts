/**
 * 서버/클라이언트 동일 출력 (hydration 안전).
 * 모든 공개 포맷은 Intl·toLocaleString 없이 서울(UTC+9, DST 없음) 벽시계를 수동 조합합니다.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** JS getUTCDay()와 동일: 0=일 … 6=토 */
const WEEKDAY_SUN0 = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * UTC instant → 서울(UTC+9) 벽시계 연·월·일·시·분·초
 */
function toSeoulWallParts(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (Number.isNaN(d.getTime())) return null;
  const t = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours() + 9,
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  );
  const x = new Date(t);
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth() + 1,
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
    second: x.getUTCSeconds(),
  };
}

/** 그레고리력 연·월·일의 요일 약자 (서울 달력과 동일) */
function weekdayShortKo(year: number, month: number, day: number): string {
  const dow = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return WEEKDAY_SUN0[dow];
}

/** `오전/오후 h:mm` (시는 1–12) */
function formatSeoulTimeAmPm(hour: number, minute: number): string {
  const isPm = hour >= 12;
  const period = isPm ? "오후" : "오전";
  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  return `${period} ${h12}:${pad2(minute)}`;
}

/** `YYYY년 M월 D일` (서울 기준) */
export function formatKoreanDate(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  return `${p.year}년 ${p.month}월 ${p.day}일`;
}

/**
 * `YYYY년 M월 D일 오전/오후 h시 mm분` (서울 기준, 12시 표기).
 * **초는 표시하지 않음** — 입력이 ISO 문자열(초 포함)이어도 분·시만 노출.
 */
export function formatKoreanDateTime(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  const isPm = p.hour >= 12;
  const period = isPm ? "오후" : "오전";
  let h12 = p.hour % 12;
  if (h12 === 0) h12 = 12;
  return `${p.year}년 ${p.month}월 ${p.day}일 ${period} ${h12}시 ${pad2(p.minute)}분`;
}

/**
 * 짧은 표기: `M월 D일 오전/오후 h:mm` (참가 신청·입금 등)
 */
export function formatKoreanDateShort(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  return `${p.month}월 ${p.day}일 ${formatSeoulTimeAmPm(p.hour, p.minute)}`;
}

/**
 * 일정: `M월 D일 (요) 오전/오후 h:mm` — 구간이면 ` … ~ …`
 */
export function formatKoreanSchedule(
  startAt: string | number | Date,
  endAt?: string | number | Date | null
): string {
  const fmt = (d: Date): string => {
    const p = toSeoulWallParts(d);
    if (!p) return "—";
    const w = weekdayShortKo(p.year, p.month, p.day);
    return `${p.month}월 ${p.day}일 (${w}) ${formatSeoulTimeAmPm(p.hour, p.minute)}`;
  };
  const s = new Date(startAt);
  const e = endAt != null ? new Date(endAt) : null;
  return e ? `${fmt(s)} ~ ${fmt(e)}` : fmt(s);
}

/** `YYYY년 M월 D일 (요)` */
export function formatKoreanDateWithWeekday(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  const w = weekdayShortKo(p.year, p.month, p.day);
  return `${p.year}년 ${p.month}월 ${p.day}일 (${w})`;
}

/** `M월 D일 (요)` — 연도 생략 (홈 카드 등) */
export function formatKoreanMonthDayWeekday(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  const w = weekdayShortKo(p.year, p.month, p.day);
  return `${p.month}월 ${p.day}일 (${w})`;
}

/** 리스트용 `MM.DD` (서울 기준 달력일) */
export function formatCommunityListDate(v: string | number | Date): string {
  const p = toSeoulWallParts(new Date(v));
  if (!p) return "—";
  return `${pad2(p.month)}.${pad2(p.day)}`;
}

/**
 * DTO/JSON 직렬화·`unstable_cache` 등으로 `Date`가 문자열로 들어온 경우까지 처리해
 * UTC ISO 8601 문자열로 통일한다.
 *
 * - `Date` → `toISOString()` (Invalid Date면 빈 문자열)
 * - 파싱 가능한 문자열 → `new Date(v).toISOString()`
 * - 파싱 불가 문자열 → 원문 유지(디버깅·하위 호환)
 */
export function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return "";
    return value.toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toISOString();
}
