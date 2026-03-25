/**
 * 페이지/구간별 로딩 시간 측정 (개발·운영에서 병목 구간 확인용).
 * 서버: getServerTiming() / logServerTiming(). 클라이언트: performance.now() 또는 Navigation Timing.
 * 클라이언트·서버 perf 로그는 NEXT_PUBLIC_PERF_LOG=1 일 때만 출력.
 */
/** 명시적으로 켤 때만 로그 (배포 기본값: 출력 없음) */
const ENABLED = process.env.NEXT_PUBLIC_PERF_LOG === "1";

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

// --- 클라이언트 전용 (브라우저에서만 동작) ---
const CLIENT_ENABLED = typeof window !== "undefined" && process.env.NEXT_PUBLIC_PERF_LOG === "1";

/** 클라이언트: 페이지 진입 후 첫 렌더/ hydration 구간 측정용. mount 시점에 호출 */
export function logClientTiming(label: string, startMs: number): number {
  const end = typeof performance !== "undefined" ? performance.now() : Date.now() - startMs;
  const duration = Math.round(end - startMs);
  if (CLIENT_ENABLED && typeof console !== "undefined" && console.info) {
    console.info(`[perf:client] ${label}: ${duration}ms`);
  }
  return duration;
}

/** 클라이언트: Navigation Timing 기반 TTFB / DCL / LCP 후보 로그 (mount 시 한 번 호출 권장) */
export function logNavigationTiming(): void {
  if (!CLIENT_ENABLED || typeof window === "undefined" || !window.performance?.getEntriesByType) return;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!nav) return;
  const ttfb = nav.responseStart - nav.requestStart;
  const dcl = nav.domContentLoadedEventEnd - nav.startTime;
  if (typeof console !== "undefined" && console.info) {
    console.info(`[perf:client] ttfb: ${Math.round(ttfb)}ms, dcl: ${Math.round(dcl)}ms`);
  }
}
