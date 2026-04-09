"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageBuilderMobilePreview } from "@/components/admin/page-builder/PageBuilderMobilePreview";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import {
  PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS,
  resolvePlatformCardTemplateStylePolicy,
} from "@/lib/platform-card-templates";

type BuilderPage = "home" | "community" | "tournaments";
type SectionType = "text" | "image" | "cta";
type TextAlign = "left" | "center" | "right";
type StepKey = "step1" | "step2" | "step3" | "step4";
type StepState = "open" | "done" | "locked";
type CardKind = "default" | "custom" | "publishedTournament" | "publishedVenue";
type SpacingPreset = "compact" | "normal" | "wide";
type ElementType = "text" | "card" | "cta";
type ButtonShape = "square" | "circle";
type TextMode = "cms" | "cta";
type ElementPlacement =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "insideLeft"
  | "insideCenter"
  | "insideRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight"
  | "outsideTopLeft"
  | "outsideTopCenter"
  | "outsideTopRight"
  | "outsideBottomLeft"
  | "outsideBottomCenter"
  | "outsideBottomRight";
type ElementRegion = "blockTop" | "blockInside" | "blockBottom" | "outsideTop" | "outsideBottom";
type ElementAlign = "left" | "center" | "right";

type BuilderElement = {
  id: string;
  type: ElementType;
  textMode?: TextMode;
  textTitle?: string;
  textBody?: string;
  textHref?: string;
  textAlign?: ElementAlign;
  textColor?: string;
  textSize?: number;
  cardKind?: CardKind;
  ctaLabel?: string;
  ctaHref?: string;
  buttonAlign?: ElementAlign;
  buttonColor?: string;
  buttonShape?: ButtonShape;
  placement?: ElementPlacement;
};

type SectionButton = {
  id: string;
  name: string;
  linkType: "internal" | "external";
  href: string;
  openInNewTab: boolean;
  isPrimary: boolean;
};

type PageSection = {
  id: string;
  type: SectionType;
  title: string;
  subtitle: string | null;
  description: string | null;
  textAlign: TextAlign;
  page: BuilderPage;
  placement: "below_header" | "main_visual_bg" | "below_main_copy" | "above_content" | "content_middle" | "content_bottom";
  imageUrl: string | null;
  imageUrlMobile: string | null;
  imageHeightPc: number | null;
  imageHeightMobile: number | null;
  linkType: "none" | "internal" | "external";
  internalPage: string | null;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  buttons: SectionButton[];
  isVisible: boolean;
  sortOrder: number;
  slotType?: string | null;
  slotConfigJson?: string | null;
  startAt: string | null;
  endAt: string | null;
  backgroundColor?: string | null;
  sectionStyleJson?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type StyleMap = Record<string, unknown>;

const PAGE_OPTIONS: Array<{ value: BuilderPage; label: string }> = [
  { value: "home", label: "메인페이지" },
  { value: "community", label: "커뮤니티" },
  { value: "tournaments", label: "대회 페이지" },
];

const DEFAULT_CARD_FIELD_OPTIONS = [
  { value: "title", label: "제목(title)" },
  { value: "description", label: "내용(description)" },
  { value: "subtitle", label: "부제목(subtitle)" },
  { value: "imageUrl", label: "이미지(imageUrl)" },
  { value: "imageUrlMobile", label: "모바일 이미지(imageUrlMobile)" },
  { value: "externalUrl", label: "외부링크(externalUrl)" },
] as const;

const INITIAL_STEPS: Record<StepKey, StepState> = {
  step1: "open",
  step2: "locked",
  step3: "locked",
  step4: "locked",
};

function resolveCardKind(raw: unknown): CardKind {
  return raw === "custom" ||
    raw === "publishedTournament" ||
    raw === "publishedVenue"
    ? (raw as CardKind)
    : "default";
}

function isPublishedCardKind(kind: CardKind): boolean {
  return kind === "publishedTournament" || kind === "publishedVenue";
}

function normalizeSpacingPreset(raw: unknown, fallback: SpacingPreset = "normal"): SpacingPreset {
  return raw === "compact" || raw === "wide" || raw === "normal"
    ? (raw as SpacingPreset)
    : fallback;
}

function spacingPresetPx(group: "block" | "element" | "card", preset: SpacingPreset): number {
  if (group === "block") {
    if (preset === "compact") return 8;
    if (preset === "wide") return 22;
    return 14;
  }
  if (group === "element") {
    if (preset === "compact") return 4;
    if (preset === "wide") return 12;
    return 8;
  }
  if (preset === "compact") return 8;
  if (preset === "wide") return 18;
  return 12;
}

function normalizeSpacingPx(raw: unknown, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(48, n));
}

function normalizeElementPlacement(raw: unknown): ElementPlacement {
  if (
    raw === "topLeft" ||
    raw === "topCenter" ||
    raw === "topRight" ||
    raw === "insideLeft" ||
    raw === "insideCenter" ||
    raw === "insideRight" ||
    raw === "bottomLeft" ||
    raw === "bottomCenter" ||
    raw === "bottomRight" ||
    raw === "outsideTopLeft" ||
    raw === "outsideTopCenter" ||
    raw === "outsideTopRight" ||
    raw === "outsideBottomLeft" ||
    raw === "outsideBottomCenter" ||
    raw === "outsideBottomRight"
  ) {
    return raw as ElementPlacement;
  }
  if (raw === "top") return "topCenter";
  if (raw === "bottom") return "bottomCenter";
  if (raw === "outsideLeft") return "outsideBottomLeft";
  if (raw === "outsideCenter") return "outsideBottomCenter";
  if (raw === "outsideRight") return "outsideBottomRight";
  if (raw === "headerRight") return "topRight";
  if (raw === "blockBottomLeft") return "insideLeft";
  if (raw === "blockBottomCenter") return "insideCenter";
  if (raw === "blockBottomRight") return "insideRight";
  if (raw === "outsideBottomLeft") return "outsideBottomLeft";
  if (raw === "outsideBottomCenter") return "outsideBottomCenter";
  if (raw === "outsideBottomRight") return "outsideBottomRight";
  return "topCenter";
}

function normalizeElementRegion(raw: unknown): ElementRegion {
  return raw === "blockTop" ||
    raw === "blockInside" ||
    raw === "blockBottom" ||
    raw === "outsideTop" ||
    raw === "outsideBottom"
    ? (raw as ElementRegion)
    : "blockTop";
}

function normalizeElementAlign(raw: unknown): ElementAlign {
  return raw === "center" || raw === "right" ? (raw as ElementAlign) : "left";
}

function placementFromRegionAlign(region: ElementRegion, align: ElementAlign): ElementPlacement {
  if (region === "blockTop") {
    if (align === "center") return "topCenter";
    if (align === "right") return "topRight";
    return "topLeft";
  }
  if (region === "blockInside") {
    if (align === "center") return "insideCenter";
    if (align === "right") return "insideRight";
    return "insideLeft";
  }
  if (region === "blockBottom") {
    if (align === "center") return "bottomCenter";
    if (align === "right") return "bottomRight";
    return "bottomLeft";
  }
  if (region === "outsideTop") {
    if (align === "center") return "outsideTopCenter";
    if (align === "right") return "outsideTopRight";
    return "outsideTopLeft";
  }
  if (align === "center") return "outsideBottomCenter";
  if (align === "right") return "outsideBottomRight";
  return "outsideBottomLeft";
}

function regionAlignFromPlacement(raw: unknown): { region: ElementRegion; align: ElementAlign } {
  const placement = normalizeElementPlacement(raw);
  if (placement === "topLeft") return { region: "blockTop", align: "left" };
  if (placement === "topCenter") return { region: "blockTop", align: "center" };
  if (placement === "topRight") return { region: "blockTop", align: "right" };
  if (placement === "insideLeft") return { region: "blockInside", align: "left" };
  if (placement === "insideCenter") return { region: "blockInside", align: "center" };
  if (placement === "insideRight") return { region: "blockInside", align: "right" };
  if (placement === "bottomLeft") return { region: "blockBottom", align: "left" };
  if (placement === "bottomCenter") return { region: "blockBottom", align: "center" };
  if (placement === "bottomRight") return { region: "blockBottom", align: "right" };
  if (placement === "outsideTopLeft") return { region: "outsideTop", align: "left" };
  if (placement === "outsideTopCenter") return { region: "outsideTop", align: "center" };
  if (placement === "outsideTopRight") return { region: "outsideTop", align: "right" };
  if (placement === "outsideBottomLeft") return { region: "outsideBottom", align: "left" };
  if (placement === "outsideBottomCenter") return { region: "outsideBottom", align: "center" };
  return { region: "outsideBottom", align: "right" };
}

function allowedPlacementsForElement(type: ElementType): ElementPlacement[] {
  if (type === "card") return ["insideLeft", "insideCenter", "insideRight"];
  if (type === "cta") {
    return [
      "topLeft",
      "topCenter",
      "topRight",
      "bottomLeft",
      "bottomCenter",
      "bottomRight",
      "outsideTopLeft",
      "outsideTopCenter",
      "outsideTopRight",
      "outsideBottomLeft",
      "outsideBottomCenter",
      "outsideBottomRight",
    ];
  }
  return [
    "topLeft",
    "topCenter",
    "topRight",
    "insideLeft",
    "insideCenter",
    "insideRight",
    "bottomLeft",
    "bottomCenter",
    "bottomRight",
    "outsideTopLeft",
    "outsideTopCenter",
    "outsideTopRight",
    "outsideBottomLeft",
    "outsideBottomCenter",
    "outsideBottomRight",
  ];
}

function normalizePlacementForElement(type: ElementType, raw: unknown): ElementPlacement {
  const normalized = normalizeElementPlacement(raw);
  const allowed = allowedPlacementsForElement(type);
  return allowed.includes(normalized) ? normalized : allowed[0];
}

function normalizeElementColor(raw: unknown, fallback: string): string {
  const value = String(raw ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return fallback;
  return value;
}

function normalizeElementTextSize(raw: unknown, fallback: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(10, Math.min(48, n));
}

function normalizeTextMode(raw: unknown): TextMode {
  return raw === "cta" ? "cta" : "cms";
}

function normalizeButtonShape(raw: unknown): ButtonShape {
  return raw === "circle" ? "circle" : "square";
}

function placementAlignClass(value: ElementPlacement): "justify-start" | "justify-center" | "justify-end" {
  const { align } = regionAlignFromPlacement(value);
  if (align === "center") return "justify-center";
  if (align === "right") return "justify-end";
  return "justify-start";
}

function placementLabel(value: ElementPlacement): string {
  const { region, align } = regionAlignFromPlacement(value);
  const alignLabel = align === "center" ? "가운데" : align === "right" ? "우" : "좌";
  if (region === "blockTop") return `블록 상단: ${alignLabel}`;
  if (region === "blockInside") return `블록 내부: ${alignLabel}`;
  if (region === "blockBottom") return `블록 하단: ${alignLabel}`;
  if (region === "outsideTop") return `블록 외부 상단: ${alignLabel}`;
  return `블록 외부 하단: ${alignLabel}`;
}

function elementTypeLabel(type: ElementType): string {
  if (type === "text") return "텍스트";
  if (type === "card") return "카드";
  return "버튼";
}

function emptyBuilderElement(type: ElementType): BuilderElement {
  if (type === "text") {
    return {
      id: makeId("el"),
      type,
      textMode: "cms",
      textTitle: "제목",
      textBody: "설명",
      textHref: "",
      textAlign: "left",
      textColor: "#374151",
      textSize: 14,
      placement: "topLeft",
    };
  }
  if (type === "card") return { id: makeId("el"), type, cardKind: "default", placement: "insideCenter" };
  return {
    id: makeId("el"),
    type,
    ctaLabel: "전체보기",
    ctaHref: "/tournaments",
    buttonAlign: "left",
    buttonColor: "#2563eb",
    buttonShape: "square",
    placement: "bottomLeft",
  };
}

function toBuilderElement(raw: unknown): BuilderElement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== "text" && o.type !== "card" && o.type !== "cta") return null;
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id : makeId("el"),
    type: o.type as ElementType,
    textMode: normalizeTextMode(o.textMode),
    textTitle: typeof o.textTitle === "string" ? o.textTitle : "",
    textBody: typeof o.textBody === "string" ? o.textBody : "",
    textHref: typeof o.textHref === "string" ? o.textHref : "",
    textAlign: normalizeElementAlign(o.textAlign),
    textColor: normalizeElementColor(o.textColor, "#374151"),
    textSize: normalizeElementTextSize(o.textSize, 14),
    cardKind: resolveCardKind(o.cardKind),
    ctaLabel: typeof o.ctaLabel === "string" ? o.ctaLabel : "전체보기",
    ctaHref: typeof o.ctaHref === "string" ? o.ctaHref : "/tournaments",
    buttonAlign: normalizeElementAlign(o.buttonAlign),
    buttonColor: normalizeElementColor(o.buttonColor, "#2563eb"),
    buttonShape: normalizeButtonShape(o.buttonShape),
    placement: normalizePlacementForElement(
      o.type as ElementType,
      (o.placement ?? o.ctaPlacement) as unknown
    ),
  };
}

function resolveBuilderElements(style: StyleMap, draft: PageSection | null): BuilderElement[] {
  const raw = style.contentElements;
  if (Array.isArray(raw)) {
    const normalized = raw.map((it) => toBuilderElement(it)).filter(Boolean) as BuilderElement[];
    if (normalized.length > 0) return normalized;
  }
  const fallback: BuilderElement[] = [];
  fallback.push({
    id: makeId("el"),
    type: "text",
    textMode: "cms",
    textTitle: draft?.title ?? "",
    textBody: draft?.description ?? "",
    textHref: "",
    textAlign: "left",
    textColor: normalizeElementColor(style.contentColor, "#374151"),
    textSize: normalizeElementTextSize(style.contentSize, 14),
    placement: "topLeft",
  });
  if (Array.isArray(style.contentExtras)) {
    for (const item of style.contentExtras as unknown[]) {
      const text = String(item ?? "").trim();
      if (!text) continue;
      fallback.push({
        id: makeId("el"),
        type: "text",
        textMode: "cms",
        textTitle: "",
        textBody: text,
        textHref: "",
        textAlign: "left",
        textColor: normalizeElementColor(style.contentColor, "#374151"),
        textSize: normalizeElementTextSize(style.contentSize, 14),
        placement: "topLeft",
      });
    }
  }
  if (Boolean(style.cardEnabled)) {
    fallback.push({
      id: makeId("el"),
      type: "card",
      cardKind: resolveCardKind(style.cardKind),
      placement: normalizePlacementForElement("card", style.cardPlacement),
    });
  }
  if (String(style.contentMode ?? "cms") === "cta" && String(style.contentCtaLink ?? "").trim()) {
    fallback.push({
      id: makeId("el"),
      type: "cta",
      ctaLabel: "전체보기",
      ctaHref: String(style.contentCtaLink ?? ""),
      buttonAlign: "left",
      buttonColor: "#2563eb",
      buttonShape: "square",
      placement: normalizePlacementForElement("cta", style.contentCtaPlacement),
    });
  }
  return fallback;
}

function parseStyle(json: string | null | undefined): StyleMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as StyleMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toStyleJson(map: StyleMap): string {
  return JSON.stringify(map);
}

function normalizePublishedTournamentAutoStyle(style: StyleMap, section: PageSection | null): StyleMap {
  if (!section || section.slotType !== "tournamentIntro") return style;
  const kind = resolveCardKind(style.cardKind);
  const loadMode = String(style.publishedCardLoadMode ?? "latest");
  if (kind !== "publishedTournament" || loadMode !== "latest") return style;

  const takeRaw = Number(style.publishedCardTake ?? 6);
  const displayCount = [4, 6, 8].includes(takeRaw) ? takeRaw : 6;
  const currentList =
    style.slotBlockTournamentList && typeof style.slotBlockTournamentList === "object"
      ? (style.slotBlockTournamentList as Record<string, unknown>)
      : null;

  return {
    ...style,
    slotBlockItems: {
      mode: "auto",
      publishedType: "tournament",
    },
    slotBlockTournamentList: {
      sortBy: "latest",
      displayCount,
      slideEnabled: currentList?.slideEnabled !== false,
      showMoreButton: currentList?.showMoreButton !== false,
    },
  };
}

function buildStep1StylePatch(input: {
  s1Layout: "full" | "boxed";
  s1Mode: "cms" | "cta";
  s1CtaLink: string;
  s1Shape: "circle" | "square";
  s1Width: number;
  s1Height: number;
  s1Radius: number;
  s1BorderEnabled: boolean;
  s1BorderColor: string;
  s1BgImageMode: "link" | "attach";
  s1BgImage: string;
}): StyleMap {
  return {
    blockLayout: input.s1Layout,
    blockMode: input.s1Mode,
    blockCtaLink: input.s1CtaLink.trim(),
    blockShape: input.s1Shape,
    blockWidth: input.s1Width,
    blockHeight: input.s1Height,
    blockRadius: input.s1Radius,
    blockBorderEnabled: input.s1BorderEnabled,
    blockBorderColor: input.s1BorderColor,
    blockBgImageInputMode: input.s1BgImageMode,
    blockBgImage: input.s1BgImage.trim(),
  };
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildNewSection(page: BuilderPage, type: SectionType, sortOrder: number): Omit<PageSection, "createdAt" | "updatedAt"> {
  const id = makeId("pbn");
  return {
    id,
    type,
    title: "",
    subtitle: null,
    description: null,
    textAlign: "left",
    page,
    placement: "content_middle",
    imageUrl: null,
    imageUrlMobile: null,
    imageHeightPc: 400,
    imageHeightMobile: 280,
    linkType: "none",
    internalPage: null,
    internalPath: null,
    externalUrl: null,
    openInNewTab: false,
    buttons: [],
    isVisible: true,
    sortOrder,
    slotType: null,
    slotConfigJson: null,
    startAt: null,
    endAt: null,
    backgroundColor: "#ffffff",
    sectionStyleJson: null,
    deletedAt: null,
  };
}

export default function AdminSitePageBuilderNewPage() {
  const [page, setPage] = useState<BuilderPage>("home");
  const [rows, setRows] = useState<PageSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PageSection | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(INITIAL_STEPS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [createType, setCreateType] = useState<SectionType>("text");
  const [step1EditMode, setStep1EditMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [s1Layout, setS1Layout] = useState<"full" | "boxed">("boxed");
  const [s1Mode, setS1Mode] = useState<"cms" | "cta">("cms");
  const [s1CtaLink, setS1CtaLink] = useState("");
  const [s1Shape, setS1Shape] = useState<"circle" | "square">("square");
  const [s1Width, setS1Width] = useState(0);
  const [s1Height, setS1Height] = useState(0);
  const [s1Radius, setS1Radius] = useState(12);
  const [s1BorderEnabled, setS1BorderEnabled] = useState(false);
  const [s1BgColor, setS1BgColor] = useState("#ffffff");
  const [s1BorderColor, setS1BorderColor] = useState("#d1d5db");
  const [s1BgImageMode, setS1BgImageMode] = useState<"link" | "attach">("link");
  const [s1BgImage, setS1BgImage] = useState("");
  const [adminCopy, setAdminCopy] = useState<Record<string, string>>({});
  const resetStep1Inputs = () => {
    setStep1EditMode(false);
    setCreateType("text");
    setS1Layout("boxed");
    setS1Mode("cms");
    setS1CtaLink("");
    setS1Shape("square");
    setS1Width(0);
    setS1Height(0);
    setS1Radius(12);
    setS1BorderEnabled(false);
    setS1BgColor("#ffffff");
    setS1BorderColor("#d1d5db");
    setS1BgImageMode("link");
    setS1BgImage("");
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/copy", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data !== "object") return;
        if (!cancelled) setAdminCopy(data as Record<string, string>);
      } catch {
        // keep current copy fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const style = useMemo(() => parseStyle(draft?.sectionStyleJson), [draft?.sectionStyleJson]);
  const step1StylePatch = useMemo(
    () =>
      buildStep1StylePatch({
        s1Layout,
        s1Mode,
        s1CtaLink,
        s1Shape,
        s1Width,
        s1Height,
        s1Radius,
        s1BorderEnabled,
        s1BorderColor,
        s1BgImageMode,
        s1BgImage,
      }),
    [
      s1Layout,
      s1Mode,
      s1CtaLink,
      s1Shape,
      s1Width,
      s1Height,
      s1Radius,
      s1BorderEnabled,
      s1BorderColor,
      s1BgImageMode,
      s1BgImage,
    ]
  );
  const step1PreviewDraft = useMemo(() => {
    if (steps.step1 !== "open") return null;
    if (step1EditMode && draft) {
      return {
        ...draft,
        backgroundColor: s1BgColor,
        sectionStyleJson: toStyleJson({
          ...parseStyle(draft.sectionStyleJson),
          ...step1StylePatch,
        }),
      };
    }
    if (step1EditMode) return null;
    const tempSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 0;
    return {
      ...buildNewSection(page, createType, tempSort),
      id: "__step1_preview__",
      backgroundColor: s1BgColor,
      externalUrl: s1Mode === "cta" ? s1CtaLink.trim() : null,
      sectionStyleJson: toStyleJson(step1StylePatch),
    } as PageSection;
  }, [
    steps.step1,
    step1EditMode,
    draft,
    s1BgColor,
    step1StylePatch,
    rows,
    page,
    createType,
    s1Mode,
    s1CtaLink,
  ]);
  const legacySpacing = normalizeSpacingPreset(style.contentSpacingPreset, "normal");
  const spacingMode = String(style.spacingMode ?? "preset") === "custom" ? "custom" : "preset";
  const blockSpacingPreset = normalizeSpacingPreset(style.blockSpacingPreset, legacySpacing);
  const elementSpacingPreset = normalizeSpacingPreset(style.elementSpacingPreset, legacySpacing);
  const cardSpacingPreset = normalizeSpacingPreset(style.cardSpacingPreset, legacySpacing);
  const blockSpacingPx =
    spacingMode === "custom"
      ? normalizeSpacingPx(style.blockSpacingPx, spacingPresetPx("block", blockSpacingPreset))
      : spacingPresetPx("block", blockSpacingPreset);
  const elementSpacingPx =
    spacingMode === "custom"
      ? normalizeSpacingPx(style.elementSpacingPx, spacingPresetPx("element", elementSpacingPreset))
      : spacingPresetPx("element", elementSpacingPreset);
  const cardSpacingPx =
    spacingMode === "custom"
      ? normalizeSpacingPx(style.cardSpacingPx, spacingPresetPx("card", cardSpacingPreset))
      : spacingPresetPx("card", cardSpacingPreset);
  const elements = useMemo(() => resolveBuilderElements(style, draft), [style, draft]);
  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedElementId) ?? elements[0] ?? null,
    [elements, selectedElementId]
  );
  useEffect(() => {
    if (elements.length === 0) {
      if (selectedElementId !== null) setSelectedElementId(null);
      return;
    }
    if (!selectedElementId || !elements.some((el) => el.id === selectedElementId)) {
      setSelectedElementId(elements[0].id);
    }
  }, [elements, selectedElementId]);
  const publishedTemplateStyles = useMemo(
    () => ({
      basic: resolvePlatformCardTemplateStylePolicy(
        adminCopy?.[PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.basic] ?? null,
        "basic"
      ),
      highlight: resolvePlatformCardTemplateStylePolicy(
        adminCopy?.[PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.highlight] ?? null,
        "highlight"
      ),
    }),
    [adminCopy]
  );

  const previewRows = useMemo(() => {
    if (step1PreviewDraft) {
      if (step1EditMode && selectedId) {
        return rows.map((r) => (r.id === selectedId ? step1PreviewDraft : r));
      }
      return [...rows, step1PreviewDraft].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    if (!selectedId || !draft) return rows;
    return rows.map((r) => (r.id === selectedId ? draft : r));
  }, [rows, selectedId, draft, step1PreviewDraft, step1EditMode]);
  const selectedBlockPreviewRows = useMemo(() => {
    if (selectedId) {
      const found = previewRows.find((r) => r.id === selectedId);
      return found ? [found] : [];
    }
    if (step1PreviewDraft) return [step1PreviewDraft];
    if (draft) return [draft];
    return [];
  }, [previewRows, selectedId, step1PreviewDraft, draft]);
  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return rows.findIndex((r) => r.id === selectedId);
  }, [rows, selectedId]);

  const selected = useMemo(() => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null), [rows, selectedId]);

  const loadRows = async (
    targetPage: BuilderPage,
    options?: { preserveSelectedId?: string | null }
  ) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/content/page-layout?page=${encodeURIComponent(targetPage)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setError(typeof data?.error === "string" ? data.error : "목록을 불러오지 못했습니다.");
        setRows([]);
        setSelectedId(null);
        setDraft(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      const nextRows = data as PageSection[];
      setRows(nextRows);
      if (nextRows.length === 0) {
        setSelectedId(null);
        setDraft(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      const preserveId = options?.preserveSelectedId ?? selectedId;
      const preserved = preserveId ? nextRows.find((row) => row.id === preserveId) ?? null : null;
      const target = preserved ?? nextRows[0];
      setSelectedId(target.id);
      setDraft({ ...target, buttons: Array.isArray(target.buttons) ? [...target.buttons] : [] });
      setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
    } catch {
      setError("목록을 불러오지 못했습니다.");
      setRows([]);
      setSelectedId(null);
      setDraft(null);
      setSteps(INITIAL_STEPS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(page);
  }, [page]);

  const publishCurrentPage = async (targetPage: BuilderPage): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/content/cms-page-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", page: targetPage }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "저장 반영(게시)에 실패했습니다.");
        return false;
      }
      return true;
    } catch {
      setError("저장 반영(게시) 중 오류가 발생했습니다.");
      return false;
    }
  };

  const persist = async (next: PageSection): Promise<PageSection | null> => {
    setSaving(true);
    try {
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...body } = next;
      const normalizedStyle = normalizePublishedTournamentAutoStyle(
        parseStyle(body.sectionStyleJson),
        next
      );
      const bodyWithNormalizedStyle = {
        ...body,
        sectionStyleJson: toStyleJson(normalizedStyle),
      };
      const res = await fetch("/api/admin/content/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithNormalizedStyle),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return null;
      }
      return data as PageSection;
    } catch {
      setError("저장 중 오류가 발생했습니다.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveDraftOnly = async () => {
    if (!draft) {
      setError("선택된 블록이 없습니다.");
      return;
    }
    setError("");
    setMessage("");
    const saved = await persist(draft);
    if (!saved) return;
    setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setDraft(saved);
    setMessage("초안 저장 완료 (메인 미반영)");
  };

  const publishNow = async () => {
    if (publishing || saving || busy) return;
    if (!window.confirm("현재 초안을 메인에 반영하시겠습니까?")) return;
    setPublishing(true);
    setError("");
    setMessage("");
    try {
      let targetDraft = draft;
      if (targetDraft) {
        const saved = await persist(targetDraft);
        if (!saved) return;
        setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        setDraft(saved);
      }
      const published = await publishCurrentPage(page);
      if (!published) return;
      setMessage("게시 완료 (메인 반영)");
    } finally {
      setPublishing(false);
    }
  };

  const updateStyle = (patch: StyleMap) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextStyle = normalizePublishedTournamentAutoStyle(
        { ...parseStyle(prev.sectionStyleJson), ...patch },
        prev
      );
      return { ...prev, sectionStyleJson: toStyleJson(nextStyle) };
    });
  };

  const updateDraft = (patch: Partial<PageSection>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateElements = (next: BuilderElement[]) => {
    const firstText = next.find((it) => it.type === "text");
    const firstTextPlacement = normalizePlacementForElement("text", firstText?.placement ?? "topLeft");
    const extraTexts = next
      .filter((it) => it.type === "text")
      .slice(1)
      .map((it) => String(it.textBody ?? ""));
    const firstCard = next.find((it) => it.type === "card");
    const firstCta = next.find((it) => it.type === "cta");
    updateStyle({
      contentElements: next.map((it) => ({
        id: it.id,
        type: it.type,
        textMode: normalizeTextMode(it.textMode),
        textTitle: it.textTitle ?? "",
        textBody: it.textBody ?? "",
        textHref: it.textHref ?? "",
        textAlign: normalizeElementAlign(it.textAlign),
        textColor: normalizeElementColor(it.textColor, "#374151"),
        textSize: normalizeElementTextSize(it.textSize, 14),
        cardKind: it.cardKind ?? "default",
        ctaLabel: it.ctaLabel ?? "전체보기",
        ctaHref: it.ctaHref ?? "",
        buttonAlign: normalizeElementAlign(it.buttonAlign),
        buttonColor: normalizeElementColor(it.buttonColor, "#2563eb"),
        buttonShape: normalizeButtonShape(it.buttonShape),
        placement: normalizePlacementForElement(it.type, it.placement),
      })),
      contentExtras: extraTexts,
      cardEnabled: Boolean(firstCard),
      cardKind: firstCard?.cardKind ?? style.cardKind ?? "default",
      cardPlacement: firstCard ? normalizePlacementForElement("card", firstCard.placement) : style.cardPlacement ?? "insideCenter",
      contentMode: firstCta && String(firstCta.ctaHref ?? "").trim() ? "cta" : "cms",
      contentCtaLink: firstCta?.ctaHref ?? "",
      contentCtaPlacement: firstCta ? normalizePlacementForElement("cta", firstCta.placement) : "topCenter",
      titlePosition:
        regionAlignFromPlacement(firstTextPlacement).region === "blockTop"
          ? "top"
          : regionAlignFromPlacement(firstTextPlacement).region === "blockBottom"
            ? "bottom"
            : "middle",
      titleAlign:
        regionAlignFromPlacement(firstTextPlacement).align === "center"
          ? "center"
          : regionAlignFromPlacement(firstTextPlacement).align === "right"
            ? "right"
            : "left",
      contentAlign:
        regionAlignFromPlacement(firstTextPlacement).align === "center"
          ? "center"
          : regionAlignFromPlacement(firstTextPlacement).align === "right"
            ? "right"
            : "left",
      textPlacement: firstTextPlacement,
    });
    if (firstText) {
      updateDraft({
        title: String(firstText.textTitle ?? ""),
        description: String(firstText.textBody ?? ""),
      });
    }
  };

  const addElement = (type: ElementType) => {
    const created = emptyBuilderElement(type);
    updateElements([...elements, created]);
    setSelectedElementId(created.id);
  };

  const loadStep1FromDraft = (source: PageSection | null) => {
    if (!source) return;
    const s = parseStyle(source.sectionStyleJson);
    setS1Layout(String(s.blockLayout ?? "boxed") === "full" ? "full" : "boxed");
    setS1Mode(String(s.blockMode ?? "cms") === "cta" ? "cta" : "cms");
    setS1CtaLink(String(s.blockCtaLink ?? source.externalUrl ?? ""));
    setS1Shape(String(s.blockShape ?? "square") === "circle" ? "circle" : "square");
    setS1Width(Number(s.blockWidth ?? 0) || 0);
    setS1Height(Number(s.blockHeight ?? 0) || 0);
    setS1Radius(Number(s.blockRadius ?? 12) || 12);
    setS1BorderEnabled(Boolean(s.blockBorderEnabled));
    setS1BorderColor(String(s.blockBorderColor ?? "#d1d5db"));
    setS1BgColor(String(source.backgroundColor ?? "#ffffff"));
    setS1BgImageMode(String(s.blockBgImageInputMode ?? "link") === "attach" ? "attach" : "link");
    setS1BgImage(String(s.blockBgImage ?? ""));
  };


  const openStep = (step: StepKey) => {
    if (step === "step1") {
      setStep1EditMode(true);
      loadStep1FromDraft(draft);
    }
    setSteps({
      step1: step === "step1" ? "open" : "done",
      step2: step === "step2" ? "open" : step === "step1" ? "locked" : "done",
      step3: step === "step3" ? "open" : step === "step4" ? "done" : "locked",
      step4: step === "step4" ? "open" : "locked",
    });
  };

  const selectRow = (id: string) => {
    const found = rows.find((r) => r.id === id);
    if (!found) return;
    setSelectedId(found.id);
    setDraft({ ...found, buttons: Array.isArray(found.buttons) ? [...found.buttons] : [] });
    setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
  };

  const completeStep1 = async () => {
    setError("");
    setMessage("");
    if (s1Mode === "cta" && !s1CtaLink.trim()) {
      setError("CTA를 선택하면 링크를 입력해야 합니다.");
      return;
    }
    const stylePatch: StyleMap = step1StylePatch;

    if (step1EditMode && draft) {
      const next = {
        ...draft,
        backgroundColor: s1BgColor,
        sectionStyleJson: toStyleJson({ ...parseStyle(draft.sectionStyleJson), ...stylePatch }),
      };
      setDraft(next);
      const saved = await persist(next);
      if (!saved) return;
      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDraft(saved);
      setStep1EditMode(false);
      setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
      setMessage("STEP 1 완료");
      return;
    }

    setBusy(true);
    try {
      const nextSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
      const payload = buildNewSection(page, createType, nextSort);
      payload.backgroundColor = s1BgColor;
      payload.externalUrl = s1Mode === "cta" ? s1CtaLink.trim() : null;
      payload.sectionStyleJson = toStyleJson(stylePatch);
      const res = await fetch("/api/admin/content/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "블록 생성에 실패했습니다.");
        return;
      }
      const created = data as PageSection;
      setRows((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setSelectedId(created.id);
      setDraft(created);
      setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
      setMessage("STEP 1 완료");
    } catch {
      setError("블록 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const completeStep2 = async () => {
    if (!draft) return;
    setError("");
    setMessage("");
    const saved = await persist(draft);
    if (!saved) return;
    setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setDraft(saved);
    setSteps({ step1: "done", step2: "done", step3: "open", step4: "locked" });
    setMessage("STEP 2 완료");
  };

  const completeStep3 = async () => {
    if (!draft) return;
    setError("");
    setMessage("");
    const cardEnabled = Boolean(parseStyle(draft.sectionStyleJson).cardEnabled);
    const next = {
      ...draft,
      sectionStyleJson: toStyleJson({ ...parseStyle(draft.sectionStyleJson), cardCreated: cardEnabled }),
    };
    setDraft(next);
    const saved = await persist(next);
    if (!saved) return;
    setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setDraft(saved);
    setSteps({ step1: "done", step2: "done", step3: "done", step4: cardEnabled ? "open" : "locked" });
    setMessage("STEP 3 완료");
  };

  const completeStep4 = async () => {
    if (!draft) return;
    setError("");
    setMessage("");
    const next = {
      ...draft,
      sectionStyleJson: toStyleJson({ ...parseStyle(draft.sectionStyleJson), cardContentCreated: true }),
    };
    setDraft(next);
    const saved = await persist(next);
    if (!saved) return;
    setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    setDraft(saved);
    setSteps({ step1: "done", step2: "done", step3: "done", step4: "done" });
    setMessage("STEP 4 완료");
  };

  const duplicateSelected = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicateSection", id: selectedId, targetPage: page }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "복제에 실패했습니다.");
        return;
      }
      const created = data as PageSection;
      setRows((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setSelectedId(created.id);
      setDraft(created);
      setMessage("복제 완료");
    } catch {
      setError("복제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    const current = rows.find((r) => r.id === selectedId);
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "softDeleteSection", id: selectedId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "삭제에 실패했습니다.");
        return;
      }
      const currentIndex = rows.findIndex((r) => r.id === selectedId);
      const nextRows = rows.filter((r) => r.id !== selectedId);
      setRows(nextRows);
      if (nextRows.length === 0) {
        setSelectedId(null);
        setDraft(null);
        setSteps(INITIAL_STEPS);
      } else {
        const nextIndex = currentIndex >= nextRows.length ? nextRows.length - 1 : Math.max(0, currentIndex);
        const nextSelected = nextRows[nextIndex];
        setSelectedId(nextSelected.id);
        setDraft({ ...nextSelected, buttons: Array.isArray(nextSelected.buttons) ? [...nextSelected.buttons] : [] });
        setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
      }
      setMessage("삭제 완료");
    } catch {
      setError("삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "visibility", id: draft.id, isVisible: !draft.isVisible }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "숨김 상태 변경에 실패했습니다.");
        return;
      }
      const updated = data as PageSection;
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedId === updated.id) setDraft(updated);
      setMessage(updated.isVisible ? "보이는 상태" : "숨김 상태");
    } catch {
      setError("숨김 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const moveSelected = async (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const currentSelectedId = selectedId;
    const to = selectedIndex + direction;
    if (to < 0 || to >= rows.length) return;
    const reordered = [...rows];
    const tmp = reordered[selectedIndex];
    reordered[selectedIndex] = reordered[to];
    reordered[to] = tmp;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", page, orderedIds: reordered.map((r) => r.id) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "순서 변경에 실패했습니다.");
        return;
      }
      await loadRows(page, { preserveSelectedId: currentSelectedId });
      setMessage("순서 변경 완료");
    } catch {
      setError("순서 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const beginStep1Create = () => {
    resetStep1Inputs();
    setError("");
    setMessage("");
    setSteps({ step1: "open", step2: "locked", step3: "locked", step4: "locked" });
  };

  const previewPanel = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 rounded-xl border border-site-border bg-white p-2 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-[360px]">
          <PageBuilderMobilePreview
            page={page as PageBuilderKey}
            rows={previewRows as unknown as import("@/types/page-section").PageSection[]}
            variant="mobile"
            selectedBlockId={selectedId}
            autoScrollOnSelect={false}
            showTitle={false}
            onSelectBlock={selectRow}
          />
        </div>
        <div className="mx-auto mt-2 w-max max-w-none">
          <div className="flex flex-nowrap items-center gap-1">
            <button type="button" onClick={() => openStep("step2")} disabled={!selectedId || busy} className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium leading-none text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50">수정</button>
            <button type="button" onClick={() => void deleteSelected()} disabled={!selectedId || busy} className="whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium leading-none text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50">삭제</button>
            <button type="button" onClick={() => void toggleVisible()} disabled={!selectedId || busy} className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium leading-none text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50">숨김/보이기</button>
            <button type="button" onClick={() => void duplicateSelected()} disabled={!selectedId || busy} className="whitespace-nowrap rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium leading-none text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200 dark:hover:bg-purple-950/50">복제</button>
            <button type="button" onClick={() => void moveSelected(-1)} disabled={!selectedId || busy || selectedIndex <= 0} className="whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-1 text-[11px] font-medium leading-none text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">위로</button>
            <button type="button" onClick={() => void moveSelected(1)} disabled={!selectedId || busy || selectedIndex < 0 || selectedIndex >= rows.length - 1} className="whitespace-nowrap rounded-full border border-gray-300 bg-gray-100 px-2 py-1 text-[11px] font-medium leading-none text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">아래로</button>
            <button type="button" onClick={beginStep1Create} disabled={busy || saving} className="whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold leading-none text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200 dark:hover:bg-green-950/50">
            + 블록 추가
            </button>
          </div>
        </div>
        {!selectedId ? <p className="mx-auto mt-2 w-full max-w-[320px] text-xs text-gray-500 dark:text-slate-400">선택된 블록이 없습니다.</p> : null}
      </div>
      <div className="min-h-0 flex-[1.3] rounded-xl border border-site-border bg-white p-2 dark:bg-slate-900">
        <PageBuilderMobilePreview
          page={page as PageBuilderKey}
          rows={selectedBlockPreviewRows as unknown as import("@/types/page-section").PageSection[]}
          variant="page"
          selectedBlockId={selectedId}
          autoScrollOnSelect={false}
          showTitle={false}
          onSelectBlock={selectRow}
        />
      </div>
    </div>
  );

  const stepSummary = (step: StepKey) => {
    if (step === "step1") return `${s1Layout === "full" ? "전체형" : "박스형"} / ${s1Mode.toUpperCase()}`;
    if (step === "step2") return `${draft?.title ? "제목 있음" : "제목 없음"} / ${draft?.description ? "내용 있음" : "내용 없음"}`;
    if (step === "step3") return Boolean(style.cardEnabled) ? "카드 사용" : "카드 사용 안 함";
    return "카드 내용 반영";
  };

  const editorHeader = (
    <div className="rounded-xl border border-site-border bg-white p-2 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold text-site-text">페이지빌더 NEW</h1>
          <select value={page} onChange={(e) => setPage(e.target.value as BuilderPage)} className="rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-900">
            {PAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void saveDraftOnly()}
            disabled={!draft || saving || busy || publishing}
            className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            {saving ? "저장 중..." : "초안 저장"}
          </button>
          <button
            type="button"
            onClick={() => void publishNow()}
            disabled={loading || saving || busy || publishing}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
          >
            {publishing ? "게시 중..." : "게시"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">초안 저장만으로는 메인에 반영되지 않습니다. 메인 반영은 게시 버튼을 눌러야 합니다.</p>
      {message ? <p className="mt-1 text-xs text-green-700 dark:text-green-300">{message}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );

  const blockSettingsPanel = (
    <div className="space-y-2">
      <div className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-site-text">블록 설정</h2>
      </div>

      {steps.step1 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 1: 블록 생성</h2>
          {!step1EditMode ? (
            <select value={createType} onChange={(e) => setCreateType(e.target.value as SectionType)} className="mt-3 w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="text">텍스트 블록</option>
              <option value="image">이미지 블록</option>
              <option value="cta">CTA 블록</option>
            </select>
          ) : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select value={s1Layout} onChange={(e) => setS1Layout(e.target.value as "full" | "boxed")} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="full">전체형</option>
              <option value="boxed">박스형</option>
            </select>
            <select value={s1Mode} onChange={(e) => setS1Mode(e.target.value as "cms" | "cta")} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="cms">CMS</option>
              <option value="cta">CTA</option>
            </select>
            {s1Mode === "cta" ? (
              <input value={s1CtaLink} onChange={(e) => setS1CtaLink(e.target.value)} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
            ) : null}
            <select value={s1Shape} onChange={(e) => setS1Shape(e.target.value as "circle" | "square")} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="circle">원형</option>
              <option value="square">사각형</option>
            </select>
            <input type="number" value={s1Width} onChange={(e) => setS1Width(Number(e.target.value || 0))} placeholder="크기(가로)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <input type="number" value={s1Height} onChange={(e) => setS1Height(Number(e.target.value || 0))} placeholder="크기(세로)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <input type="number" value={s1Radius} onChange={(e) => setS1Radius(Number(e.target.value || 0))} placeholder="모서리(px)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <label className="flex items-center gap-2 rounded border border-site-border px-3 py-2 text-sm">
              <input type="checkbox" checked={s1BorderEnabled} onChange={(e) => setS1BorderEnabled(e.target.checked)} />
              외곽선
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-600 dark:text-slate-400">배경색상</span>
              <input type="color" value={s1BgColor} onChange={(e) => setS1BgColor(e.target.value)} className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-600 dark:text-slate-400">외곽선색상</span>
              <input type="color" value={s1BorderColor} onChange={(e) => setS1BorderColor(e.target.value)} className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <select
                value={s1BgImageMode}
                onChange={(e) => setS1BgImageMode(e.target.value as "link" | "attach")}
                className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
              >
                <option value="link">이미지 방식: 링크 사용</option>
                <option value="attach">이미지 방식: 첨부 사용</option>
              </select>
              {s1BgImageMode === "link" ? (
                <input value={s1BgImage} onChange={(e) => setS1BgImage(e.target.value)} placeholder="배경이미지 링크 입력" className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
              ) : (
                <AdminImageField
                  label="배경이미지 첨부"
                  value={s1BgImage || null}
                  onChange={(url) => setS1BgImage(url ?? "")}
                  policy="section"
                  recommendedSize="1200x675"
                />
              )}
            </div>
          </div>
          <button type="button" onClick={() => void completeStep1()} disabled={busy || saving} className="mt-3 rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">
            STEP 1 완료
          </button>
        </section>
      ) : steps.step1 === "done" ? (
        <section className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-site-text">STEP 1: 블록 생성 (완료)</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stepSummary("step1")}</p>
            </div>
            <button type="button" onClick={() => openStep("step1")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">블록 수정</button>
          </div>
        </section>
      ) : null}

      {steps.step2 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 2: 블록 내용 입력</h2>
          {draft ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-2 rounded border border-site-border p-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">요소 목록</p>
                <div className="space-y-2">
                  {elements.map((el, idx) => {
                    const isSelected = selectedElement?.id === el.id;
                    return (
                      <div
                        key={el.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedElementId(el.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedElementId(el.id);
                          }
                        }}
                        className={`w-full rounded border px-3 py-2 text-left ${
                          isSelected
                            ? "border-site-primary bg-site-primary/10"
                            : "border-site-border bg-white dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-site-text">
                            {idx + 1}. {elementTypeLabel(el.type)}
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                const next = [...elements];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                updateElements(next);
                              }}
                              className="rounded border border-site-border px-2 py-1 text-[11px] disabled:opacity-40"
                            >
                              위
                            </button>
                            <button
                              type="button"
                              disabled={idx === elements.length - 1}
                              onClick={(event) => {
                                event.stopPropagation();
                                const next = [...elements];
                                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                updateElements(next);
                              }}
                              className="rounded border border-site-border px-2 py-1 text-[11px] disabled:opacity-40"
                            >
                              아래
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                updateElements(elements.filter((it) => it.id !== el.id));
                              }}
                              className="rounded border border-site-border px-2 py-1 text-[11px]"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                          위치: {placementLabel(normalizePlacementForElement(el.type, el.placement))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 rounded border border-site-border p-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">요소 추가</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => addElement("text")}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    + 텍스트 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => addElement("card")}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    + 카드 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => addElement("cta")}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    + 버튼 추가
                  </button>
                </div>
              </div>
              {selectedElement ? (
                <div className="space-y-2 rounded border border-site-border p-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                    선택된 요소 설정: {elementTypeLabel(selectedElement.type)}
                  </p>
                  {selectedElement.type === "text" ? (
                    <div className="grid gap-2">
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">용도</span>
                        <select
                          value={normalizeTextMode(selectedElement.textMode)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? { ...it, textMode: normalizeTextMode(e.target.value) }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="cms">CMS</option>
                          <option value="cta">CTA</option>
                        </select>
                      </label>
                      <input
                        value={String(selectedElement.textTitle ?? "")}
                        onChange={(e) =>
                          updateElements(
                            elements.map((it) =>
                              it.id === selectedElement.id ? { ...it, textTitle: e.target.value } : it
                            )
                          )
                        }
                        placeholder="텍스트 제목"
                        className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      />
                      <textarea
                        value={String(selectedElement.textBody ?? "")}
                        onChange={(e) =>
                          updateElements(
                            elements.map((it) =>
                              it.id === selectedElement.id ? { ...it, textBody: e.target.value } : it
                            )
                          )
                        }
                        placeholder="텍스트 내용"
                        className="min-h-20 rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      />
                      {normalizeTextMode(selectedElement.textMode) === "cta" ? (
                        <input
                          value={String(selectedElement.textHref ?? "")}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id ? { ...it, textHref: e.target.value } : it
                              )
                            )
                          }
                          placeholder="CTA 링크 경로"
                          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        />
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="block text-[11px] text-gray-600 dark:text-slate-400">색상</span>
                          <input
                            type="color"
                            value={normalizeElementColor(selectedElement.textColor, "#374151")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) =>
                                  it.id === selectedElement.id
                                    ? { ...it, textColor: normalizeElementColor(e.target.value, "#374151") }
                                    : it
                                )
                              )
                            }
                            className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[11px] text-gray-600 dark:text-slate-400">크기</span>
                          <input
                            type="number"
                            value={normalizeElementTextSize(selectedElement.textSize, 14)}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) =>
                                  it.id === selectedElement.id
                                    ? { ...it, textSize: normalizeElementTextSize(e.target.value, 14) }
                                    : it
                                )
                              )
                            }
                            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          />
                        </label>
                      </div>
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">정렬</span>
                        <select
                          value={normalizeElementAlign(selectedElement.textAlign)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? {
                                      ...it,
                                      textAlign: normalizeElementAlign(e.target.value),
                                      placement: placementFromRegionAlign(
                                        normalizeElementRegion(regionAlignFromPlacement(it.placement).region),
                                        normalizeElementAlign(e.target.value)
                                      ),
                                    }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="left">좌</option>
                          <option value="center">가운데</option>
                          <option value="right">우</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">위치 영역</span>
                        <select
                          value={normalizeElementRegion(regionAlignFromPlacement(selectedElement.placement).region)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? {
                                      ...it,
                                      placement: placementFromRegionAlign(
                                        normalizeElementRegion(e.target.value),
                                        normalizeElementAlign(it.textAlign)
                                      ),
                                    }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="blockTop">블록 상단</option>
                          <option value="blockInside">블록 내부</option>
                          <option value="blockBottom">블록 하단</option>
                          <option value="outsideTop">블록 외부 상단</option>
                          <option value="outsideBottom">블록 외부 하단</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {selectedElement.type === "card" ? (
                    <div className="grid gap-2">
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">카드 종류 선택</span>
                        <select
                          value={selectedElement.cardKind ?? "default"}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? { ...it, cardKind: resolveCardKind(e.target.value) }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="publishedTournament">대회 메인 게시용카드</option>
                          <option value="publishedVenue">당구장 메인 게시용카드</option>
                          <option value="default">디폴트카드</option>
                          <option value="custom">사용자설정카드</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">정렬</span>
                        <select
                          value={normalizePlacementForElement("card", selectedElement.placement)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? { ...it, placement: normalizePlacementForElement("card", e.target.value) }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="insideLeft">좌</option>
                          <option value="insideCenter">가운데</option>
                          <option value="insideRight">우</option>
                        </select>
                      </label>
                      <div className="rounded border border-site-border px-3 py-2 text-xs text-gray-600 dark:text-slate-400">
                        위치: 블록 내부(1열 고정)
                      </div>
                    </div>
                  ) : null}
                  {selectedElement.type === "cta" ? (
                    <div className="grid gap-2">
                      <input
                        value={String(selectedElement.ctaLabel ?? "전체보기")}
                        onChange={(e) =>
                          updateElements(
                            elements.map((it) =>
                              it.id === selectedElement.id ? { ...it, ctaLabel: e.target.value } : it
                            )
                          )
                        }
                        placeholder="버튼 텍스트"
                        className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      />
                      <input
                        value={String(selectedElement.ctaHref ?? "")}
                        onChange={(e) =>
                          updateElements(
                            elements.map((it) =>
                              it.id === selectedElement.id ? { ...it, ctaHref: e.target.value } : it
                            )
                          )
                        }
                        placeholder="버튼 링크"
                        className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      />
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">위치 영역</span>
                        <select
                          value={normalizeElementRegion(regionAlignFromPlacement(selectedElement.placement).region)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? {
                                      ...it,
                                      placement: placementFromRegionAlign(
                                        normalizeElementRegion(e.target.value),
                                        normalizeElementAlign(it.buttonAlign)
                                      ),
                                    }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="blockTop">블록 상단</option>
                          <option value="blockBottom">블록 하단</option>
                          <option value="outsideTop">블록 외부 상단</option>
                          <option value="outsideBottom">블록 외부 하단</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[11px] text-gray-600 dark:text-slate-400">정렬</span>
                        <select
                          value={normalizeElementAlign(selectedElement.buttonAlign)}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === selectedElement.id
                                  ? {
                                      ...it,
                                      buttonAlign: normalizeElementAlign(e.target.value),
                                      placement: placementFromRegionAlign(
                                        normalizeElementRegion(regionAlignFromPlacement(it.placement).region),
                                        normalizeElementAlign(e.target.value)
                                      ),
                                    }
                                  : it
                              )
                            )
                          }
                          className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                        >
                          <option value="left">좌</option>
                          <option value="center">가운데</option>
                          <option value="right">우</option>
                        </select>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="block text-[11px] text-gray-600 dark:text-slate-400">버튼 색상</span>
                          <input
                            type="color"
                            value={normalizeElementColor(selectedElement.buttonColor, "#2563eb")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) =>
                                  it.id === selectedElement.id
                                    ? { ...it, buttonColor: normalizeElementColor(e.target.value, "#2563eb") }
                                    : it
                                )
                              )
                            }
                            className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[11px] text-gray-600 dark:text-slate-400">버튼 모양</span>
                          <select
                            value={normalizeButtonShape(selectedElement.buttonShape)}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) =>
                                  it.id === selectedElement.id
                                    ? { ...it, buttonShape: normalizeButtonShape(e.target.value) }
                                    : it
                                )
                              )
                            }
                            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          >
                            <option value="square">사각형</option>
                            <option value="circle">원형</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="pt-1">
                <button type="button" onClick={() => void completeStep2()} disabled={saving} className="rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">
                  STEP 2 완료
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : steps.step2 === "done" ? (
        <section className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-site-text">STEP 2: 블록 내용 입력 (완료)</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stepSummary("step2")}</p>
            </div>
            <button type="button" onClick={() => openStep("step2")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">내용 수정</button>
          </div>
        </section>
      ) : null}

    </div>
  );

  const cardSettingsPanel = (
    <div className="space-y-2">
      <div className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-site-text">카드 설정</h2>
      </div>

      {steps.step3 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 3: 카드 생성</h2>
          {draft ? (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(style.cardEnabled)} onChange={(e) => updateStyle({ cardEnabled: e.target.checked })} />
                카드 사용
              </label>
              {Boolean(style.cardEnabled) ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={String(style.cardShape ?? "square")} onChange={(e) => updateStyle({ cardShape: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="square">카드 모양: 사각형</option>
                    <option value="circle">카드 모양: 원형</option>
                  </select>
                  <input type="color" value={String(style.cardColor ?? "#ffffff")} onChange={(e) => updateStyle({ cardColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
                  <input type="number" value={Number(style.cardWidth ?? 320)} onChange={(e) => updateStyle({ cardWidth: Number(e.target.value || 320) })} placeholder="카드 크기(가로)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  <input type="number" value={Number(style.cardHeight ?? 180)} onChange={(e) => updateStyle({ cardHeight: Number(e.target.value || 180) })} placeholder="카드 크기(세로)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  <input type="number" value={Number(style.cardRadius ?? 12)} onChange={(e) => updateStyle({ cardRadius: Number(e.target.value || 12) })} placeholder="카드 모서리(px)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  <label className="flex items-center gap-2 rounded border border-site-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={Boolean(style.cardBorderEnabled)} onChange={(e) => updateStyle({ cardBorderEnabled: e.target.checked })} />
                    카드 외곽선
                  </label>
                  <input type="color" value={String(style.cardBorderColor ?? "#d1d5db")} onChange={(e) => updateStyle({ cardBorderColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
                  <select
                    value={resolveCardKind(style.cardKind)}
                    onChange={(e) => updateStyle({ cardKind: e.target.value })}
                    className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  >
                    <option value="publishedTournament">대회 메인 게시용카드</option>
                    <option value="publishedVenue">당구장 메인 게시용카드</option>
                    <option value="default">디폴트카드</option>
                    <option value="custom">사용자설정카드</option>
                  </select>
                  {!isPublishedCardKind(resolveCardKind(style.cardKind)) ? (
                    <>
                      <select value={String(style.cardMode ?? "cms")} onChange={(e) => updateStyle({ cardMode: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                        <option value="cms">CMS</option>
                        <option value="cta">CTA</option>
                      </select>
                      {String(style.cardMode ?? "cms") === "cta" ? (
                        <input value={String(style.cardCtaLink ?? "")} onChange={(e) => updateStyle({ cardCtaLink: e.target.value })} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100 sm:col-span-2">
                      메인 게시용카드 선택 시 STEP 4에서 게시카드 불러오기 방식이 열립니다.
                    </div>
                  )}
                </div>
              ) : null}
              <button type="button" onClick={() => void completeStep3()} disabled={saving} className="rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">
                STEP 3 완료
              </button>
            </div>
          ) : null}
        </section>
      ) : steps.step3 === "done" ? (
        <section className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-site-text">STEP 3: 카드 생성 (완료)</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stepSummary("step3")}</p>
            </div>
            <button type="button" onClick={() => openStep("step3")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">카드 수정</button>
          </div>
        </section>
      ) : null}

      {steps.step4 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 4: 카드 내용 입력</h2>
          {draft ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) ? (
                <>
                  <select value={String(style.cardThumbShape ?? "round")} onChange={(e) => updateStyle({ cardThumbShape: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="circle">원형 썸네일</option>
                    <option value="round">둥근 썸네일</option>
                  </select>
                  <select value={String(style.cardThumbPosition ?? "left")} onChange={(e) => updateStyle({ cardThumbPosition: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="left">이미지 위치: 좌</option>
                    <option value="right">이미지 위치: 우</option>
                  </select>
                  <select value={String(style.cardSplit ?? "top-bottom")} onChange={(e) => updateStyle({ cardSplit: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="top-bottom">분할형: 상/하</option>
                    <option value="left-right">분할형: 좌/우</option>
                  </select>
                  <select value={String(style.cardRatio ?? "1:1")} onChange={(e) => updateStyle({ cardRatio: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="1:3">비율 1:3</option>
                    <option value="1:2">비율 1:2</option>
                    <option value="1:1">비율 1:1</option>
                  </select>
                  <div className="space-y-2 sm:col-span-2">
                    <select
                      value={String(style.cardImageInputMode ?? "link")}
                      onChange={(e) => updateStyle({ cardImageInputMode: e.target.value })}
                      className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                    >
                      <option value="link">이미지 방식: 링크 사용</option>
                      <option value="attach">이미지 방식: 첨부 사용</option>
                    </select>
                    {String(style.cardImageInputMode ?? "link") === "link" ? (
                      <input
                        value={String(style.cardBackgroundImage ?? "")}
                        onChange={(e) => updateStyle({ cardBackgroundImage: e.target.value })}
                        placeholder="배경이미지 링크 입력"
                        className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                      />
                    ) : (
                      <AdminImageField
                        label="카드 이미지 첨부"
                        value={String(style.cardBackgroundImage ?? "") || null}
                        onChange={(url) => updateStyle({ cardBackgroundImage: url ?? "" })}
                        policy="section"
                        recommendedSize="1200x675"
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100 sm:col-span-2">
                  <p className="font-semibold">
                    {resolveCardKind(style.cardKind) === "publishedVenue" ? "당구장 메인 게시용카드" : "대회 메인 게시용카드"} 불러오기
                  </p>
                  <select
                    value={String(style.publishedCardLoadMode ?? "latest")}
                    onChange={(e) => updateStyle({ publishedCardLoadMode: e.target.value })}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                  >
                    <option value="latest">최신 게시카드 자동 불러오기</option>
                    <option value="manual">목록에서 직접 선택</option>
                  </select>
                  {String(style.publishedCardLoadMode ?? "latest") === "latest" ? (
                    <div className="space-y-2 rounded border border-sky-200 bg-sky-100/40 p-2 dark:border-sky-900/60 dark:bg-sky-950/20">
                      <div className="text-[11px] font-semibold text-sky-900 dark:text-sky-100">자동 불러오기 설정</div>
                      <div className="space-y-1">
                        <span className="block text-[11px] text-sky-800 dark:text-sky-200">불러올 개수</span>
                        <div className="flex flex-wrap gap-2">
                          {[4, 6, 8].map((n) => {
                            const selected = Number(style.publishedCardTake ?? 6) === n;
                            return (
                              <button
                                key={`published-card-take-${n}`}
                                type="button"
                                onClick={() => updateStyle({ publishedCardTake: n })}
                                className={
                                  selected
                                    ? "rounded border border-site-primary bg-site-primary/15 px-2.5 py-1 text-xs font-semibold text-site-primary"
                                    : "rounded border border-site-border px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                }
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-[11px] text-sky-800 dark:text-sky-200">정렬 방식: 최신순(고정)</p>
                    </div>
                  ) : null}
                  {String(style.publishedCardLoadMode ?? "latest") === "manual" ? (
                    <input
                      value={String(style.publishedCardPickKey ?? "")}
                      onChange={(e) => updateStyle({ publishedCardPickKey: e.target.value })}
                      placeholder="선택할 게시카드 ID/키 입력"
                      className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                    />
                  ) : null}
                  <p className="text-[11px] text-sky-800 dark:text-sky-200">
                    저장 후 메인 화면에서는 선택한 운영용 게시카드 스냅샷으로 렌더됩니다.
                  </p>
                </div>
              )}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) && resolveCardKind(style.cardKind) === "default" ? (
                <>
                  <label className="space-y-1">
                    <span className="block text-xs text-gray-600 dark:text-slate-400">제목 값 설정</span>
                    <select
                      value={String(style.defaultTitleSource ?? "direct")}
                      onChange={(e) => updateStyle({ defaultTitleSource: e.target.value })}
                      className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                    >
                      <option value="direct">직접 입력</option>
                      <option value="field">필드에서 가져오기</option>
                    </select>
                    {String(style.defaultTitleSource ?? "direct") === "field" ? (
                      <select value={String(style.cardTitleField ?? "title")} onChange={(e) => updateStyle({ cardTitleField: e.target.value })} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                        {DEFAULT_CARD_FIELD_OPTIONS.map((opt) => (
                          <option key={`title-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : null}
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs text-gray-600 dark:text-slate-400">내용 값 설정</span>
                    <select
                      value={String(style.defaultBodySource ?? "direct")}
                      onChange={(e) => updateStyle({ defaultBodySource: e.target.value })}
                      className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                    >
                      <option value="direct">직접 입력</option>
                      <option value="field">필드에서 가져오기</option>
                    </select>
                    {String(style.defaultBodySource ?? "direct") === "field" ? (
                      <select value={String(style.cardBodyField ?? "description")} onChange={(e) => updateStyle({ cardBodyField: e.target.value })} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                        {DEFAULT_CARD_FIELD_OPTIONS.map((opt) => (
                          <option key={`body-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : null}
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="block text-xs text-gray-600 dark:text-slate-400">이미지 값 설정</span>
                    <select
                      value={String(style.defaultImageSource ?? "direct")}
                      onChange={(e) => updateStyle({ defaultImageSource: e.target.value })}
                      className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                    >
                      <option value="direct">직접 첨부</option>
                      <option value="field">필드에서 가져오기</option>
                    </select>
                    {String(style.defaultImageSource ?? "direct") === "field" ? (
                      <select value={String(style.cardImageField ?? "imageUrl")} onChange={(e) => updateStyle({ cardImageField: e.target.value })} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                        {DEFAULT_CARD_FIELD_OPTIONS.map((opt) => (
                          <option key={`image-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : null}
                  </label>
                </>
              ) : null}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) && String(style.defaultTitleSource ?? "direct") !== "field" ? (
                <input value={String(style.cardTitleText ?? "")} onChange={(e) => updateStyle({ cardTitleText: e.target.value })} placeholder="카드 제목 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
              ) : null}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) && String(style.defaultBodySource ?? "direct") !== "field" ? (
                <textarea value={String(style.cardBodyText ?? "")} onChange={(e) => updateStyle({ cardBodyText: e.target.value })} placeholder="카드 내용 입력" className="min-h-20 rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
              ) : null}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) && Array.isArray(style.cardExtras) ? (
                (style.cardExtras as unknown[]).map((item, idx) => (
                  <input
                    key={`card-extra-${idx}`}
                    value={String(item ?? "")}
                    onChange={(e) => {
                      const next = [...((style.cardExtras as unknown[]) ?? [])];
                      next[idx] = e.target.value;
                      updateStyle({ cardExtras: next });
                    }}
                    placeholder={`카드 내용 ${idx + 1}`}
                    className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2"
                  />
                ))
              ) : null}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) ? (
              <button type="button" onClick={() => updateStyle({ cardExtras: [...(((style.cardExtras as unknown[]) ?? [])), ""] })} className="rounded border border-site-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 sm:col-span-2">
                카드 항목추가+
                </button>
              ) : null}
              {!isPublishedCardKind(resolveCardKind(style.cardKind)) && resolveCardKind(style.cardKind) === "custom" && String(style.cardMode ?? "cms") === "cta" ? (
                <input value={String(style.cardCustomCtaLink ?? "")} onChange={(e) => updateStyle({ cardCustomCtaLink: e.target.value })} placeholder="사용자설정 카드 CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
              ) : null}
              <button type="button" onClick={() => void completeStep4()} disabled={saving} className="rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800 sm:col-span-2">
                STEP 4 완료
              </button>
            </div>
          ) : null}
        </section>
      ) : steps.step4 === "done" ? (
        <section className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-site-text">STEP 4: 카드 내용 입력 (완료)</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stepSummary("step4")}</p>
            </div>
            <button type="button" onClick={() => openStep("step4")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">카드 내용 수정</button>
          </div>
        </section>
      ) : null}
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-2 px-2 py-2 md:px-3 md:py-3">
      {loading ? (
        <div className="rounded-xl border border-site-border bg-white p-6 text-sm text-gray-500 dark:bg-slate-900 dark:text-slate-400">
          불러오는 중...
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {editorHeader}
          {blockSettingsPanel}
          {cardSettingsPanel}
          {previewPanel}
        </div>
      ) : (
        <>
          {editorHeader}
          <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 gap-2 xl:grid-cols-[1fr_1fr_1.2fr]">
            {blockSettingsPanel}
            {cardSettingsPanel}
            <div className="min-h-0 overflow-y-auto pl-1">{previewPanel}</div>
          </div>
        </>
      )}
    </div>
  );
}
