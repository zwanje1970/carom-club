/**
 * 게시판 목록 성능 로그 (서버 전용). 느린 구간 파악용.
 * `COMMUNITY_LIST_PERF_LOG=1` 일 때만 출력.
 */
const ENABLED = process.env.COMMUNITY_LIST_PERF_LOG === "1";

export function communityListPerfStart(label: string): () => void {
  if (!ENABLED) return () => undefined;
  const t0 = performance.now();
  const db0 = Date.now();
  return () => {
    const ms = performance.now() - t0;
    const line = `[community-list] ${label} done in ${ms.toFixed(1)}ms (wall ${Date.now() - db0}ms)`;
    console.log(line);
  };
}

/** 단일 async 구간(ms). 공지/일반 목록/검색 유무 비교용 */
export async function communityListPerfMeasure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!ENABLED) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - t0;
    console.log(`[community-list] ${label} ${ms.toFixed(1)}ms`);
  }
}
