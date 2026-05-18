/**
 * 메인 세로 마키 스크롤 떨림 원인 분석 — 개발 또는 `NEXT_PUBLIC_SITE_MAIN_LOAD_DIAG=1`에서만 활성.
 */

declare global {
  interface Window {
    __MAIN_SHAKE_DIAG_LOGS__?: Record<string, unknown>[];
    __COPY_MAIN_SHAKE_DIAG__?: () => void | Promise<void>;
  }
}

export {};

let sessionFrameCount = 0;
let sessionLogCount = 0;
let lastThrottleLogMs = 0;

const THROTTLE_MS = 220;
const MAX_STORED_LOG_LINES = 40;

/** 콘솔·복사 버퍼에 남기는 필드만 허용 */
const MAIN_SHAKE_DIAG_COMPACT_KEYS = [
  "diagSampleIndex",
  "diagFrameIndex",
  "scrollApplyMode",
  "scrollMotionTimingMode",
  "currentScrollValue",
  "nextScrollValue",
  "appliedMoveValue",
  "deltaTopFromPrevFrame",
  "transformOffset",
  "transformRoundedOffset",
  "hasFractionalTransform",
  "isWrapped",
  "wrapSubtractions",
  "cardTop",
  "rawDtSec",
  "fixedDeltaTotal",
  "dtDeltaTotal",
  "carryDisabled",
  "estimatedRefreshRate",
  "isHighRefreshRateDevice",
  "imageCurrentSrc",
] as const;

export function compactMainScrollShakeDiagPayload(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MAIN_SHAKE_DIAG_COMPACT_KEYS) {
    if (key in source) {
      out[key] = source[key];
    }
  }
  return out;
}

let clipboardFnInstalled = false;

function installCopyMainShakeDiagIfNeeded(): void {
  if (typeof window === "undefined" || !isMainScrollShakeDiagEnabled()) return;
  if (clipboardFnInstalled) return;
  clipboardFnInstalled = true;
  window.__COPY_MAIN_SHAKE_DIAG__ = async () => {
    const logs = window.__MAIN_SHAKE_DIAG_LOGS__ ?? [];
    const text = logs.map((o) => JSON.stringify(o)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      console.log("[main-shake-diag] copy ok", { lines: logs.length });
    } catch (e) {
      console.log("[main-shake-diag] copy failed", e);
    }
  };
}

function appendStoredShakeDiagLog(entry: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isMainScrollShakeDiagEnabled()) return;
  installCopyMainShakeDiagIfNeeded();
  if (!window.__MAIN_SHAKE_DIAG_LOGS__) {
    window.__MAIN_SHAKE_DIAG_LOGS__ = [];
  }
  window.__MAIN_SHAKE_DIAG_LOGS__.push(entry);
  while (window.__MAIN_SHAKE_DIAG_LOGS__.length > MAX_STORED_LOG_LINES) {
    window.__MAIN_SHAKE_DIAG_LOGS__.shift();
  }
}

/** JSON.stringify 가능한 순수 객체로 정규화(실패 시 저장 생략, 콘솔 로그는 그대로). */
function toSerializableLogEntry(payload: Record<string, unknown>): Record<string, unknown> | null {
  try {
    return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isMainScrollShakeDiagEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SITE_MAIN_LOAD_DIAG === "1"
  );
}

export function resetMainScrollShakeDiagSession(): void {
  if (!isMainScrollShakeDiagEnabled()) return;
  sessionFrameCount = 0;
  sessionLogCount = 0;
  lastThrottleLogMs = 0;
}

export function logMainScrollShakeDiag(payload: Record<string, unknown>): void {
  if (!isMainScrollShakeDiagEnabled()) return;
  sessionLogCount += 1;
  const slim = compactMainScrollShakeDiagPayload(payload);
  const serializable = toSerializableLogEntry(slim);
  if (serializable !== null) {
    appendStoredShakeDiagLog(serializable);
  }
  console.info("[main-shake-diag]", slim);
}

/** 매 프레임 호출: 래핑·큰 점프·스로틀 시에만 로그 */
export function maybeLogMainScrollShakeFrame(args: {
  frameTime: number;
  forceLog: boolean;
  payload: Record<string, unknown>;
}): void {
  if (!isMainScrollShakeDiagEnabled()) return;
  sessionFrameCount += 1;
  const now = args.frameTime;
  if (
    !args.forceLog &&
    now - lastThrottleLogMs < THROTTLE_MS &&
    sessionFrameCount % 45 !== 0
  ) {
    return;
  }
  lastThrottleLogMs = now;
  logMainScrollShakeDiag({
    ...compactMainScrollShakeDiagPayload(args.payload),
    diagSampleIndex: sessionLogCount,
    diagFrameIndex: sessionFrameCount,
  });
}

if (typeof window !== "undefined") {
  installCopyMainShakeDiagIfNeeded();
}
