/**
 * 페이지/구간별 로딩 시간 측정 (개발·운영에서 병목 구간 확인용).
 * 서버: getServerTiming() / logServerTiming(). 클라이언트: performance.now() 또는 Navigation Timing.
 * NODE_ENV=production 에서는 로그 레벨에 따라 출력 생략 가능.
 */
const ENABLED = process.env.NEXT_PUBLIC_PERF_LOG !== "0";

export type TimingLabel =
  | "page"
  | "db"
  | "api"
  | "render"
  | "image"
  | "fetch_tournaments"
  | "fetch_venues"
  | "fetch_copy"
  | "fetch_sections";

let serverStart: number;

/** 서버 컴포넌트 페이지 시작 시 호출 */
export function getServerTiming(): number {
  serverStart = Date.now();
  return serverStart;
}

/** 서버에서 구간 종료 시 호출. label과 소요 ms를 콘솔에 출력 */
export function logServerTiming(label: TimingLabel, startMs?: number): number {
  const end = Date.now();
  const start = startMs ?? serverStart ?? end;
  const duration = end - start;
  if (ENABLED && typeof console !== "undefined" && console.info) {
    console.info(`[perf] ${label}: ${duration}ms`);
  }
  return duration;
}

/** 여러 작업을 병렬로 실행하고, 각각의 소요 시간을 로그 (서버) */
export async function measureAsync<T>(
  label: TimingLabel,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    logServerTiming(label, start);
  }
}
