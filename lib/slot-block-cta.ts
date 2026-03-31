/**
 * 홈 구조 슬롯 CTA — sectionStyleJson.slotBlockCta
 * 콘텐츠(카피·데이터)와 클릭 동작 분리. 옵션 선택만 허용.
 */
import { parseSectionStyleJson, type SectionStyleJson } from "@/lib/section-style";
import type { PageSectionSlotType } from "@/types/page-section";
import {
  isHomeStructureSlotType,
  normalizeHomeStructureSlotType,
  type HomeStructureSlotType,
} from "@/lib/home-structure-slots";

export type SlotBlockCtaType = "none" | "internal" | "external" | "action";

export type SlotBlockCtaMapping = "auto" | "fixed";

/** 내부 라우트 논리 키 (고정 경로 또는 auto 시 엔티티 결합) */
export type SlotBlockInternalTarget =
  | "home"
  | "tournaments_list"
  | "tournament_detail"
  | "venues_list"
  | "venue_detail"
  | "community"
  | "nangu_list"
  | "mypage_notes"
  | "custom";

export type SlotBlockCtaActionKey = "none" | "scroll_top";

export type SlotBlockCtaLayer = {
  enabled: boolean;
  type: SlotBlockCtaType;
  mapping: SlotBlockCtaMapping;
  internalTarget?: SlotBlockInternalTarget | null;
  /** mapping·custom 시 경로 (항상 / 로 시작 권장) */
  fixedPath?: string | null;
  externalUrl?: string | null;
  openInNewTab?: boolean;
  actionKey?: SlotBlockCtaActionKey | null;
};

export type SlotBlockCtaLayerRole = "block" | "card" | "button" | "nanguNotes" | "nanguSolver";

export type SlotBlockCtaConfig = {
  block?: SlotBlockCtaLayer;
  card?: SlotBlockCtaLayer;
  button?: SlotBlockCtaLayer;
  nanguNotes?: SlotBlockCtaLayer;
  nanguSolver?: SlotBlockCtaLayer;
};

export type SlotBlockCtaContext = {
  tournamentId?: string | null;
  venueSlug?: string | null;
  /** 카드·블록 직접 구성 시 항목에 넣은 링크(비어 있지 않으면 우선) */
  itemDirectHref?: string | null;
};

const OFF: SlotBlockCtaLayer = {
  enabled: false,
  type: "none",
  mapping: "fixed",
  internalTarget: "home",
  fixedPath: null,
  externalUrl: null,
  openInNewTab: false,
  actionKey: "none",
};

const STATIC_INTERNAL: Partial<Record<SlotBlockInternalTarget, string>> = {
  home: "/",
  tournaments_list: "/tournaments",
  venues_list: "/venues",
  community: "/community",
  nangu_list: "/community/nangu",
  mypage_notes: "/mypage/notes",
};

const DEFAULT_BUNDLE: Record<HomeStructureSlotType, SlotBlockCtaConfig> = {
  tournamentIntro: {
    block: { ...OFF },
    card: {
      enabled: true,
      type: "internal",
      mapping: "auto",
      internalTarget: "tournament_detail",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
    button: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "tournaments_list",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
  },
  venueIntro: {
    block: { ...OFF },
    card: {
      enabled: true,
      type: "internal",
      mapping: "auto",
      internalTarget: "venue_detail",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
    button: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "venues_list",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
  },
  venueLink: {
    block: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "venues_list",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
    card: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "venues_list",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
  },
  nanguEntry: {
    nanguNotes: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "mypage_notes",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
    nanguSolver: {
      enabled: true,
      type: "internal",
      mapping: "fixed",
      internalTarget: "nangu_list",
      fixedPath: null,
      externalUrl: null,
      openInNewTab: false,
      actionKey: "none",
    },
  },
};

function normalizeCtaType(v: unknown): SlotBlockCtaType {
  if (v === "internal" || v === "external" || v === "action" || v === "none") return v;
  return "none";
}

function normalizeMapping(v: unknown): SlotBlockCtaMapping {
  return v === "auto" ? "auto" : "fixed";
}

function normalizeInternalTarget(v: unknown): SlotBlockInternalTarget {
  const keys: SlotBlockInternalTarget[] = [
    "home",
    "tournaments_list",
    "tournament_detail",
    "venues_list",
    "venue_detail",
    "community",
    "nangu_list",
    "mypage_notes",
    "custom",
  ];
  if (typeof v === "string" && keys.includes(v as SlotBlockInternalTarget)) return v as SlotBlockInternalTarget;
  return "home";
}

function normalizeActionKey(v: unknown): SlotBlockCtaActionKey {
  if (v === "scroll_top") return "scroll_top";
  return "none";
}

function partialLayer(raw: unknown): Partial<SlotBlockCtaLayer> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : undefined,
    type: o.type !== undefined ? normalizeCtaType(o.type) : undefined,
    mapping: o.mapping !== undefined ? normalizeMapping(o.mapping) : undefined,
    internalTarget: o.internalTarget !== undefined ? normalizeInternalTarget(o.internalTarget) : undefined,
    fixedPath: o.fixedPath != null ? String(o.fixedPath) : undefined,
    externalUrl: o.externalUrl != null ? String(o.externalUrl) : undefined,
    openInNewTab: typeof o.openInNewTab === "boolean" ? o.openInNewTab : undefined,
    actionKey: o.actionKey !== undefined ? normalizeActionKey(o.actionKey) : undefined,
  };
}

function mergeLayer(base: SlotBlockCtaLayer, partial: Partial<SlotBlockCtaLayer>): SlotBlockCtaLayer {
  return {
    ...base,
    ...partial,
    enabled: partial.enabled ?? base.enabled,
    type: partial.type ?? base.type,
    mapping: partial.mapping ?? base.mapping,
    internalTarget: partial.internalTarget ?? base.internalTarget,
    fixedPath: partial.fixedPath !== undefined ? partial.fixedPath : base.fixedPath,
    externalUrl: partial.externalUrl !== undefined ? partial.externalUrl : base.externalUrl,
    openInNewTab: partial.openInNewTab ?? base.openInNewTab,
    actionKey: partial.actionKey ?? base.actionKey,
  };
}

function mergeConfig(
  base: SlotBlockCtaConfig,
  raw: Record<string, unknown> | undefined
): SlotBlockCtaConfig {
  if (!raw) return JSON.parse(JSON.stringify(base)) as SlotBlockCtaConfig;
  const out: SlotBlockCtaConfig = JSON.parse(JSON.stringify(base)) as SlotBlockCtaConfig;
  (["block", "card", "button", "nanguNotes", "nanguSolver"] as const).forEach((k) => {
    if (raw[k] !== undefined) {
      const baseLayer = out[k] ?? OFF;
      out[k] = mergeLayer(baseLayer, partialLayer(raw[k]));
    }
  });
  return out;
}

function defaultBundleForSlot(slotType: PageSectionSlotType | null | undefined): SlotBlockCtaConfig {
  if (slotType && isHomeStructureSlotType(slotType)) {
    const b = DEFAULT_BUNDLE[slotType];
    return JSON.parse(JSON.stringify(b)) as SlotBlockCtaConfig;
  }
  return JSON.parse(JSON.stringify(DEFAULT_BUNDLE.tournamentIntro)) as SlotBlockCtaConfig;
}

export function parseSlotBlockCtaFromSectionJson(j: SectionStyleJson): Partial<SlotBlockCtaConfig> {
  const raw = j.slotBlockCta;
  if (!raw || typeof raw !== "object") return {};
  return raw as Partial<SlotBlockCtaConfig>;
}

/** 버튼·블록 레이어는 카드 데이터가 없으므로 auto+상세 조합 금지 → 목록 등으로 보정 */
export function sanitizeCtaLayerForRole(
  layer: SlotBlockCtaLayer,
  role: SlotBlockCtaLayerRole
): SlotBlockCtaLayer {
  const l = { ...layer };
  if (l.type === "external") {
    const u = (l.externalUrl ?? "").trim();
    if (!u) l.type = "none";
    return l;
  }
  if (l.type === "action") {
    if (!l.actionKey || l.actionKey === "none") {
      l.type = "none";
      l.enabled = false;
    }
    return l;
  }
  if (l.type !== "internal") return l;
  const noEntity = role === "block" || role === "button";
  if (noEntity && l.mapping === "auto") {
    l.mapping = "fixed";
    if (l.internalTarget === "tournament_detail") l.internalTarget = "tournaments_list";
    if (l.internalTarget === "venue_detail") l.internalTarget = "venues_list";
  }
  if (l.internalTarget === "custom") {
    const p = (l.fixedPath ?? "").trim();
    if (!p) {
      l.internalTarget = "home";
      l.mapping = "fixed";
    } else if (!p.startsWith("/")) {
      l.fixedPath = `/${p}`;
    }
  }
  return l;
}

export function sanitizeFullCtaConfig(
  slotType: PageSectionSlotType | null | undefined,
  cfg: SlotBlockCtaConfig
): SlotBlockCtaConfig {
  const out: SlotBlockCtaConfig = { ...cfg };
  const roles: { key: keyof SlotBlockCtaConfig; role: SlotBlockCtaLayerRole }[] = [
    { key: "block", role: "block" },
    { key: "card", role: "card" },
    { key: "button", role: "button" },
    { key: "nanguNotes", role: "nanguNotes" },
    { key: "nanguSolver", role: "nanguSolver" },
  ];
  for (const { key, role } of roles) {
    const layer = out[key];
    if (layer) out[key] = sanitizeCtaLayerForRole(layer, role);
  }
  return out;
}

export function resolveSlotBlockCtaConfig(
  slotType: PageSectionSlotType | null | undefined,
  sectionStyleJson: string | null | undefined
): SlotBlockCtaConfig {
  const base = defaultBundleForSlot(slotType);
  const parsed = parseSectionStyleJson(sectionStyleJson);
  const partial = parseSlotBlockCtaFromSectionJson(parsed);
  return sanitizeFullCtaConfig(slotType, mergeConfig(base, partial as Record<string, unknown>));
}

export function coerceSlotBlockCtaConfig(
  slotType: PageSectionSlotType | null | undefined,
  raw: unknown
): SlotBlockCtaConfig {
  const base = defaultBundleForSlot(slotType);
  const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return sanitizeFullCtaConfig(slotType, mergeConfig(base, parsed));
}

export function mergeSlotBlockCtaIntoSectionStyleJson(
  existingRaw: string | null | undefined,
  cfg: SlotBlockCtaConfig
): string {
  const parsed = parseSectionStyleJson(existingRaw);
  const next: SectionStyleJson = {
    ...parsed,
    slotBlockCta: cfg as unknown as Record<string, unknown>,
  };
  return JSON.stringify(next);
}

export type CtaNavigation =
  | { kind: "href"; href: string; external: boolean; newTab: boolean }
  | { kind: "action"; actionKey: SlotBlockCtaActionKey }
  | { kind: "none" };

function resolveInternalHref(layer: SlotBlockCtaLayer, ctx: SlotBlockCtaContext): string | null {
  const t = layer.internalTarget ?? "home";
  if (t === "custom") {
    const p = (layer.fixedPath ?? "").trim();
    return p ? (p.startsWith("/") ? p : `/${p}`) : "/";
  }
  if (layer.mapping === "auto") {
    if (t === "tournament_detail" && ctx.tournamentId) return `/tournaments/${ctx.tournamentId}`;
    if (t === "venue_detail" && ctx.venueSlug) return `/v/${ctx.venueSlug}`;
    if (t === "tournament_detail") return STATIC_INTERNAL.tournaments_list ?? "/tournaments";
    if (t === "venue_detail") return STATIC_INTERNAL.venues_list ?? "/venues";
  }
  if (t === "tournament_detail") {
    return ctx.tournamentId
      ? `/tournaments/${ctx.tournamentId}`
      : STATIC_INTERNAL.tournaments_list ?? "/tournaments";
  }
  if (t === "venue_detail") {
    return ctx.venueSlug ? `/v/${ctx.venueSlug}` : STATIC_INTERNAL.venues_list ?? "/venues";
  }
  return STATIC_INTERNAL[t] ?? "/";
}

export function resolveCtaNavigation(layer: SlotBlockCtaLayer | undefined, ctx: SlotBlockCtaContext): CtaNavigation {
  const direct = ctx.itemDirectHref?.trim();
  if (layer?.enabled && layer.type !== "none" && direct) {
    if (direct.startsWith("http://") || direct.startsWith("https://")) {
      return { kind: "href", href: direct, external: true, newTab: Boolean(layer.openInNewTab) };
    }
    const path = direct.startsWith("/") ? direct : `/${direct}`;
    return { kind: "href", href: path, external: false, newTab: Boolean(layer.openInNewTab) };
  }
  if (!layer || !layer.enabled || layer.type === "none") return { kind: "none" };
  if (layer.type === "action") {
    const k = layer.actionKey ?? "none";
    if (k === "none") return { kind: "none" };
    return { kind: "action", actionKey: k };
  }
  if (layer.type === "external") {
    const url = (layer.externalUrl ?? "").trim();
    if (!url) return { kind: "none" };
    return { kind: "href", href: url, external: true, newTab: layer.openInNewTab ?? false };
  }
  if (layer.type === "internal") {
    const href = resolveInternalHref(layer, ctx);
    if (!href) return { kind: "none" };
    return { kind: "href", href, external: false, newTab: layer.openInNewTab ?? false };
  }
  return { kind: "none" };
}

export function slotBlockCtaSupported(slotType: PageSectionSlotType | null | undefined): boolean {
  return normalizeHomeStructureSlotType(slotType) != null;
}

export const INTERNAL_TARGET_OPTIONS: { value: SlotBlockInternalTarget; label: string }[] = [
  { value: "home", label: "홈" },
  { value: "tournaments_list", label: "대회 목록" },
  { value: "tournament_detail", label: "대회 상세 (카드와 자동 연결)" },
  { value: "venues_list", label: "당구장 목록" },
  { value: "venue_detail", label: "당구장 상세 (카드와 자동 연결)" },
  { value: "community", label: "커뮤니티 허브" },
  { value: "nangu_list", label: "난구해결사·난구 목록" },
  { value: "mypage_notes", label: "난구노트 (마이페이지)" },
  { value: "custom", label: "직접 경로 (고정)" },
];

export function rolesForSlotType(slotType: HomeStructureSlotType): SlotBlockCtaLayerRole[] {
  switch (slotType) {
    case "nanguEntry":
      return ["nanguNotes", "nanguSolver"];
    case "venueLink":
      return ["block", "card"];
    default:
      return ["block", "card", "button"];
  }
}

export const ROLE_LABELS: Record<SlotBlockCtaLayerRole, string> = {
  block: "블록 전체 (영역)",
  card: "카드 클릭",
  button: "버튼·보조 링크 (전체보기 등)",
  nanguNotes: "난구노트 카드",
  nanguSolver: "난구해결사 카드",
};
