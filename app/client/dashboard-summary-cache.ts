import type { ClientDashboardSummaryJson } from "./dashboard-summary-types";

/** 클라이언트 대시보드 summary 전용 — 다른 키와 분리 */
const SESSION_STORAGE_KEY = "caromClub:v1:clientDashboardSummary";

/** sessionStorage 보조 TTL (밀리초) — 60~180초 권장 범위 내 */
const SESSION_TTL_MS = 120_000;

type SessionEnvelope = {
  savedAt: number;
  payload: ClientDashboardSummaryJson;
};

let memorySummary: ClientDashboardSummaryJson | null = null;

function isValidSummary(v: unknown): v is ClientDashboardSummaryJson {
  if (!v || typeof v !== "object") return false;
  const o = v as Partial<ClientDashboardSummaryJson>;
  return o.ok === true && typeof o.hasVenueIntro === "boolean";
}

export function readClientDashboardSummaryMemory(): ClientDashboardSummaryJson | null {
  return memorySummary;
}

export function writeClientDashboardSummaryMemory(data: ClientDashboardSummaryJson): void {
  memorySummary = data;
}

export function readClientDashboardSummarySession(): ClientDashboardSummaryJson | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionEnvelope;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !isValidSummary(parsed.payload) ||
      Date.now() - parsed.savedAt > SESSION_TTL_MS
    ) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function writeClientDashboardSummarySession(data: ClientDashboardSummaryJson): void {
  if (typeof window === "undefined") return;
  try {
    const env: SessionEnvelope = { savedAt: Date.now(), payload: data };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(env));
  } catch {
    // quota / private mode
  }
}

/** 메모리 우선, 없으면 TTL 유효한 session — session 히트 시 메모리에도 적재 */
export function readClientDashboardSummaryCache(): ClientDashboardSummaryJson | null {
  const m = readClientDashboardSummaryMemory();
  if (m) return m;
  const s = readClientDashboardSummarySession();
  if (s) {
    writeClientDashboardSummaryMemory(s);
    return s;
  }
  return null;
}

export function persistClientDashboardSummaryCache(data: ClientDashboardSummaryJson): void {
  writeClientDashboardSummaryMemory(data);
  writeClientDashboardSummarySession(data);
}

export function mergeClientDashboardSummaryCache(
  patch: Partial<Omit<ClientDashboardSummaryJson, "ok">>,
): void {
  if (!memorySummary || memorySummary.ok !== true) return;
  const next: ClientDashboardSummaryJson = { ...memorySummary, ...patch, ok: true };
  memorySummary = next;
  writeClientDashboardSummarySession(next);
}
