"use client";

export type AuthSessionPayload = {
  authenticated?: boolean;
  user?: {
    role?: string;
    clientStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  };
};

const TTL_MS = 90_000;

let inFlight: Promise<AuthSessionPayload> | null = null;
let cached: { at: number; data: AuthSessionPayload } | null = null;

/** `/api/auth/session` 단축·중복 방지 — FCM·기타 클라이언트 공용 */
export async function fetchAuthSessionCached(): Promise<AuthSessionPayload> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) {
    return cached.data;
  }
  if (inFlight) {
    return inFlight;
  }
  inFlight = (async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
      const data = (res.ok ? ((await res.json()) as AuthSessionPayload) : { authenticated: false }) as AuthSessionPayload;
      cached = { at: Date.now(), data };
      return data;
    } catch {
      const data: AuthSessionPayload = { authenticated: false };
      cached = { at: Date.now(), data };
      return data;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function invalidateAuthSessionFetchCache(): void {
  cached = null;
  inFlight = null;
}
