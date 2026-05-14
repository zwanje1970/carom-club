import {
  TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
  TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
} from "./tournament-card-artboard";

/** 게시 시점 템플릿 DOM에서 확정한 오버레이 슬롯 — 메인은 해석·재배치하지 않고 그대로 표시 */
export type TournamentCardOverlaySlotType =
  | "lead"
  | "title"
  | "subtitle"
  | "subtitle2"
  | "date"
  | "place"
  | "statusBadge";

export type TournamentCardOverlaySnapshotItem = {
  type: TournamentCardOverlaySlotType;
  /** 표시 문자열(배지는 원문 라벨 보존) */
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  color: string;
  textAlign: string;
  zIndex: number;
  whiteSpace: string;
  /** statusBadge 슬롯: 배지 문구(메인에서 TournamentStatusBadge 매핑용) */
  statusBadgeRaw?: string;
};

export type TournamentCardOverlaySnapshot = {
  v: 1;
  cardBaseWidth: number;
  cardBaseHeight: number;
  items: TournamentCardOverlaySnapshotItem[];
};

const OVERLAY_SLOT_TYPES = new Set<TournamentCardOverlaySlotType>([
  "lead",
  "title",
  "subtitle",
  "subtitle2",
  "date",
  "place",
  "statusBadge",
]);

const MAX_ITEMS = 24;
const MAX_TEXT_LEN = 600;

function finiteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function finiteNonNeg(n: unknown): n is number {
  return finiteNum(n) && n >= 0 && n <= 4000;
}

function strField(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

function parseOverlayItem(raw: unknown): TournamentCardOverlaySnapshotItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (type !== "lead" && type !== "title" && type !== "subtitle" && type !== "subtitle2" && type !== "date" && type !== "place" && type !== "statusBadge") {
    return null;
  }
  if (!finiteNonNeg(o.x) || !finiteNonNeg(o.y) || !finiteNonNeg(o.width) || !finiteNonNeg(o.height)) return null;
  const fontSize = typeof o.fontSize === "string" && o.fontSize.trim() ? o.fontSize.trim().slice(0, 32) : "14px";
  const fontWeight = typeof o.fontWeight === "string" && o.fontWeight.trim() ? o.fontWeight.trim().slice(0, 16) : "400";
  const lineHeight = typeof o.lineHeight === "string" && o.lineHeight.trim() ? o.lineHeight.trim().slice(0, 32) : "normal";
  const color = typeof o.color === "string" && o.color.trim() ? o.color.trim().slice(0, 64) : "#ffffff";
  const textAlign = typeof o.textAlign === "string" && o.textAlign.trim() ? o.textAlign.trim().slice(0, 16) : "start";
  const zRaw = o.zIndex;
  const zIndex = finiteNum(zRaw) ? Math.floor(Math.min(9999, Math.max(-9999, zRaw))) : 0;
  const whiteSpace =
    typeof o.whiteSpace === "string" && o.whiteSpace.trim() ? o.whiteSpace.trim().slice(0, 32) : "normal";
  const text = strField(o.text, MAX_TEXT_LEN);
  const statusBadgeRaw =
    type === "statusBadge" && typeof o.statusBadgeRaw === "string" && o.statusBadgeRaw.trim()
      ? o.statusBadgeRaw.trim().slice(0, 120)
      : type === "statusBadge" && text
        ? text.slice(0, 120)
        : undefined;
  return {
    type,
    text,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    fontSize,
    fontWeight,
    lineHeight,
    color,
    textAlign,
    zIndex,
    whiteSpace,
    ...(statusBadgeRaw ? { statusBadgeRaw } : {}),
  };
}

/**
 * API·저장소에서 읽은 값 검증. 통과 시에만 `PublishedCardSnapshot.overlaySnapshot` 등에 실어 둔다.
 */
export function parsePublishedCardOverlaySnapshotForStorage(raw: unknown): TournamentCardOverlaySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const w = o.cardBaseWidth;
  const h = o.cardBaseHeight;
  if (!finiteNum(w) || !finiteNum(h)) return null;
  if (Math.abs(w - TOURNAMENT_CARD_ARTBOARD_WIDTH_PX) > 2 || Math.abs(h - TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX) > 2) {
    return null;
  }
  const itemsRaw = o.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0 || itemsRaw.length > MAX_ITEMS) return null;
  const items: TournamentCardOverlaySnapshotItem[] = [];
  for (const row of itemsRaw) {
    const it = parseOverlayItem(row);
    if (it) items.push(it);
  }
  if (items.length === 0) return null;
  const hasTitle = items.some((x) => x.type === "title");
  if (!hasTitle) return null;
  return {
    v: 1,
    cardBaseWidth: TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
    cardBaseHeight: TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
    items,
  };
}

export function isTournamentCardOverlaySlotType(s: string): s is TournamentCardOverlaySlotType {
  return OVERLAY_SLOT_TYPES.has(s as TournamentCardOverlaySlotType);
}
