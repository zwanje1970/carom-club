/**
 * 대진표 클라이언트 오프라인·복구 최소 지원: 마지막 정상 bracket 캐시, 더티 플래그, 대기 작업 큐.
 * (서버/Firestore 구조 변경 없음)
 */

import {
  findBracketMatchLocation,
  getSliceRoundsFromBracket,
  isEligibleBracketWinnerUserId,
  shuffleScopeForSlice,
  type BracketLike,
} from "./bracket-view-server-sync";
import { bracketSlotDisplayName } from "../../../../../lib/bracket-player-slot";

export type BracketOfflineSegment = string;

export function bracketOfflineSegment(zonesEnabled: boolean, selectedZoneId: string): BracketOfflineSegment {
  if (!zonesEnabled) return "-";
  const z = selectedZoneId.trim();
  return z || "-";
}

export function lastGoodBracketKey(tournamentId: string, seg: BracketOfflineSegment): string {
  return `v3:lastGoodBracket:${tournamentId}:${seg}`;
}

export function offlineDirtyKey(tournamentId: string, seg: BracketOfflineSegment): string {
  return `v3:bracketOfflineDirty:${tournamentId}:${seg}`;
}

export function offlinePendingKey(tournamentId: string, seg: BracketOfflineSegment): string {
  return `v3:bracketOfflinePending:${tournamentId}:${seg}`;
}

/** 같은 기기·세그먼트에서 로컬 우선 적용 세대(서버 늦은 응답으로 되돌리지 않기 위한 비교용) */
function localAuthorityRevKey(tournamentId: string, seg: BracketOfflineSegment): string {
  return `v3:bracketLocalAuthorityRev:${tournamentId}:${seg}`;
}

export function readBracketLocalAuthorityRev(tournamentId: string, seg: BracketOfflineSegment): number {
  if (typeof window === "undefined" || !tournamentId) return 0;
  try {
    const raw = window.localStorage.getItem(localAuthorityRevKey(tournamentId, seg));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 로컬 대진표를 갱신할 때마다 호출. 이후 서버 응답은 동일 세대일 때만 bracket state를 덮어쓴다. */
export function bumpBracketLocalAuthorityRev(tournamentId: string, seg: BracketOfflineSegment): number {
  if (typeof window === "undefined" || !tournamentId) return 0;
  try {
    const next = readBracketLocalAuthorityRev(tournamentId, seg) + 1;
    window.localStorage.setItem(localAuthorityRevKey(tournamentId, seg), String(next));
    return next;
  } catch {
    return readBracketLocalAuthorityRev(tournamentId, seg);
  }
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readLastGoodBracket<T>(tournamentId: string, seg: BracketOfflineSegment): T | null {
  if (typeof window === "undefined" || !tournamentId) return null;
  try {
    return safeParseJson<T>(window.localStorage.getItem(lastGoodBracketKey(tournamentId, seg)));
  } catch {
    return null;
  }
}

export function writeLastGoodBracket<T>(tournamentId: string, seg: BracketOfflineSegment, bracket: T | null): void {
  if (typeof window === "undefined" || !tournamentId) return;
  try {
    if (bracket == null) {
      window.localStorage.removeItem(lastGoodBracketKey(tournamentId, seg));
      return;
    }
    /* 즉시 직렬화 저장 — 강제 종료 직전에도 가능한 한 디스크에 남김 */
    window.localStorage.setItem(lastGoodBracketKey(tournamentId, seg), JSON.stringify(bracket));
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[bracket-offline-cache] writeLastGoodBracket failed", e);
    }
  }
}

export function readOfflineDirty(tournamentId: string, seg: BracketOfflineSegment): boolean {
  if (typeof window === "undefined" || !tournamentId) return false;
  try {
    return window.localStorage.getItem(offlineDirtyKey(tournamentId, seg)) === "1";
  } catch {
    return false;
  }
}

export function setOfflineDirty(tournamentId: string, seg: BracketOfflineSegment, dirty: boolean): void {
  if (typeof window === "undefined" || !tournamentId) return;
  try {
    const k = offlineDirtyKey(tournamentId, seg);
    if (dirty) window.localStorage.setItem(k, "1");
    else window.localStorage.removeItem(k);
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[bracket-offline-cache] setOfflineDirty failed", e);
    }
  }
}

export type BracketOfflinePendingOp =
  | { type: "winner_pick"; matchId: string; winnerUserId: string; roundNumber: number }
  | { type: "clear_winner"; matchId: string }
  | {
      type: "rename";
      roundNumber: number;
      matchId: string;
      slot: "player1" | "player2";
      displayName: string;
    }
  | {
      type: "swap";
      roundNumber: number;
      first: { matchId: string; slot: "player1" | "player2" };
      second: { matchId: string; slot: "player1" | "player2" };
    }
  | {
      type: "shuffle_round";
      roundNumber: number;
      scope: ReturnType<typeof shuffleScopeForSlice>;
    };

export function readOfflinePending(tournamentId: string, seg: BracketOfflineSegment): BracketOfflinePendingOp[] {
  if (typeof window === "undefined" || !tournamentId) return [];
  const arr = safeParseJson<BracketOfflinePendingOp[]>(
    window.localStorage.getItem(offlinePendingKey(tournamentId, seg)),
  );
  return Array.isArray(arr) ? arr : [];
}

export function writeOfflinePending(tournamentId: string, seg: BracketOfflineSegment, ops: BracketOfflinePendingOp[]): void {
  if (typeof window === "undefined" || !tournamentId) return;
  try {
    const k = offlinePendingKey(tournamentId, seg);
    if (ops.length === 0) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify(ops.slice(0, 80)));
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[bracket-offline-cache] writeOfflinePending failed", e);
    }
  }
}

export function appendOfflinePending(
  tournamentId: string,
  seg: BracketOfflineSegment,
  op: BracketOfflinePendingOp,
): void {
  const cur = readOfflinePending(tournamentId, seg);
  cur.push(op);
  writeOfflinePending(tournamentId, seg, cur);
}

function slotLabel(p: { userId: string; name: string; displayName?: string | null }): string {
  return bracketSlotDisplayName(p);
}

function cloneBracket<T>(b: T): T {
  return JSON.parse(JSON.stringify(b)) as T;
}

/** 서버 재계산 없이 해당 매치만 승자 표시(오프라인·네트워크 실패 유지용) */
export function applyLocalWinnerPick(bracket: BracketLike, matchId: string, winnerUserId: string): BracketLike | null {
  const b = cloneBracket(bracket);
  const loc = findBracketMatchLocation(b, matchId);
  if (!loc) return null;
  const m = loc.match;
  const w = winnerUserId.trim();
  if (!isEligibleBracketWinnerUserId(w)) return null;
  const p1 = m.player1.userId.trim() === w;
  const p2 = m.player2.userId.trim() === w;
  if (!p1 && !p2) return null;
  const prevW = (m.winnerUserId ?? "").trim();
  if (prevW && prevW !== w) {
    delete (m as { quickResultDetail?: unknown }).quickResultDetail;
  }
  m.winnerUserId = w;
  m.winnerName = p1 ? slotLabel(m.player1) : slotLabel(m.player2);
  m.status = "COMPLETED";
  return b;
}

function refreshRoundStatusFromMatches(round: {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: Array<{ status: "PENDING" | "COMPLETED" }>;
}): void {
  const allCompleted =
    round.matches.length > 0 && round.matches.every((m) => m.status === "COMPLETED");
  const allPending = round.matches.every((m) => m.status === "PENDING");
  if (allCompleted) round.status = "COMPLETED";
  else if (allPending) round.status = "PENDING";
  else round.status = "IN_PROGRESS";
}

/** 단일 매치 승자만 제거 */
export function applyLocalClearWinner(bracket: BracketLike, matchId: string): BracketLike | null {
  const b = cloneBracket(bracket);
  const loc = findBracketMatchLocation(b, matchId);
  if (!loc) return null;
  loc.match.winnerUserId = null;
  loc.match.winnerName = null;
  loc.match.status = "PENDING";
  delete (loc.match as { quickResultDetail?: unknown }).quickResultDetail;
  return b;
}

/** 해당 매치 승패 제거 + 같은 슬라이스에서 더 높은 라운드 번호의 매치 결과를 로컬에서 초기화(reset-after에 대응) */
export function applyLocalClearWinnerCascadeInSlice(bracket: BracketLike, matchId: string): BracketLike | null {
  const b = cloneBracket(bracket);
  const loc = findBracketMatchLocation(b, matchId);
  if (!loc) return null;
  const sliceRounds = getSliceRoundsFromBracket(b, loc.sliceKey);
  const cutRn = loc.round.roundNumber;
  for (const r of sliceRounds) {
    if (r.roundNumber <= cutRn) continue;
    for (const m of r.matches) {
      m.winnerUserId = null;
      m.winnerName = null;
      m.status = "PENDING";
      delete (m as { quickResultDetail?: unknown }).quickResultDetail;
    }
    refreshRoundStatusFromMatches(r);
  }
  loc.match.winnerUserId = null;
  loc.match.winnerName = null;
  loc.match.status = "PENDING";
  delete (loc.match as { quickResultDetail?: unknown }).quickResultDetail;
  refreshRoundStatusFromMatches(loc.round);
  return b;
}

export function applyLocalRenamePlayer(
  bracket: BracketLike,
  matchId: string,
  slot: "player1" | "player2",
  displayName: string,
): BracketLike | null {
  const b = cloneBracket(bracket);
  const loc = findBracketMatchLocation(b, matchId);
  if (!loc) return null;
  const next = displayName.trim();
  const slotPlayer = loc.match[slot] as { userId: string; name: string; displayName?: string | null };
  slotPlayer.displayName = next === "" ? null : next;
  return b;
}

export function applyLocalSwapPlayers(
  bracket: BracketLike,
  roundNumber: number,
  first: { matchId: string; slot: "player1" | "player2" },
  second: { matchId: string; slot: "player1" | "player2" },
): BracketLike | null {
  const b = cloneBracket(bracket);
  const loc1 = findBracketMatchLocation(b, first.matchId);
  const loc2 = findBracketMatchLocation(b, second.matchId);
  if (!loc1 || !loc2) return null;
  if (loc1.round.roundNumber !== roundNumber || loc2.round.roundNumber !== roundNumber) return null;
  const m1 = loc1.match;
  const m2 = loc2.match;
  const tmp = { ...m1[first.slot] };
  m1[first.slot] = { ...m2[second.slot] };
  m2[second.slot] = tmp;
  return b;
}

export async function replayShuffleRoundFetch(params: {
  tournamentId: string;
  bracketZoneQuery: string;
  roundNumber: number;
  scope: ReturnType<typeof shuffleScopeForSlice>;
}): Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }> {
  const url = `/api/client/tournaments/${params.tournamentId}/bracket/shuffle-round-one${params.bracketZoneQuery}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        scope: params.scope,
        roundNumber: params.roundNumber,
      }),
    });
    const json = (await res.json()) as { bracket?: BracketLike; error?: string };
    if (!res.ok || !json.bracket) {
      return { ok: false, error: json.error ?? "라운드 재배치에 실패했습니다." };
    }
    return { ok: true, bracket: json.bracket };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "네트워크 오류";
    return { ok: false, error: msg };
  }
}
