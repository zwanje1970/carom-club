import type { BracketPlayer } from "./server/platform-backing-store";

/** 저장용 빈 슬롯 — 표시 문구(TBD 등)는 넣지 않는다. */
export function emptyBracketPlayerSlot(): BracketPlayer {
  return { userId: "", name: "" };
}

/** 표시 전용으로 쓰이던 이름 등 */
export function isPlaceholderBracketDisplayName(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.toUpperCase() === "TBD") return true;
  if (t === "미정") return true;
  if (t === "승자 대기" || t === "승자대기") return true;
  if (t === "-" || t === "—") return true;
  if (t === "대기") return true;
  return false;
}

export function isPlaceholderBracketUserId(uid: string): boolean {
  const w = uid.trim();
  if (!w || w === "__none") return true;
  if (w.startsWith("__TBD__")) return true;
  if (w.startsWith("__FIN_WAIT__")) return true;
  if (w.startsWith("__FIN_SLOT__")) return true;
  return false;
}

/** 저장 데이터 기준 빈 슬롯 여부(화면 문구 아님) */
export function isBracketSlotDataEmpty(p: { userId?: string; name?: string; displayName?: string | null }): boolean {
  const uid = typeof p.userId === "string" ? p.userId.trim() : "";
  if (isPlaceholderBracketUserId(uid)) return true;
  const nm = typeof p.name === "string" ? p.name.trim() : "";
  const disp = typeof p.displayName === "string" ? p.displayName.trim() : "";
  const hasSubstantive =
    (nm.length > 0 && !isPlaceholderBracketDisplayName(nm)) ||
    (disp.length > 0 && !isPlaceholderBracketDisplayName(disp));
  if (uid === "" && !hasSubstantive) return true;
  return false;
}

export function bracketSlotDisplayName(
  p: { userId?: string; name: string; displayName?: string | null },
  emptyLabel = "승자 대기",
): string {
  if (isBracketSlotDataEmpty(p)) return emptyLabel;
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  if (d && !isPlaceholderBracketDisplayName(d)) return d;
  const nm = typeof p.name === "string" ? p.name.trim() : "";
  if (nm && !isPlaceholderBracketDisplayName(nm)) return nm;
  return emptyLabel;
}

/** Firestore/레거시에서 읽은 슬롯을 저장 규칙에 맞게 정리한다. */
export function normalizeBracketPlayerSlot(p: BracketPlayer): BracketPlayer {
  const uid = (p.userId ?? "").trim();
  const nm = (p.name ?? "").trim();
  const dispRaw = typeof p.displayName === "string" ? p.displayName.trim() : "";

  if (isPlaceholderBracketUserId(uid)) {
    return { userId: "", name: "", displayName: null };
  }

  const nameOut = isPlaceholderBracketDisplayName(nm) ? "" : nm;
  let displayName: string | null | undefined = p.displayName;
  if (dispRaw && isPlaceholderBracketDisplayName(dispRaw)) {
    displayName = null;
  }
  const out: BracketPlayer = { userId: uid, name: nameOut };
  if (displayName !== undefined) {
    (out as BracketPlayer & { displayName?: string | null }).displayName =
      displayName === null || String(displayName).trim() === "" ? null : displayName;
  }
  return out;
}
