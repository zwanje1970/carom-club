"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import MobilePreview from "./mobile-preview";
import ColorPalettePicker from "./color-palette-picker";
import {
  PageBuilderCanvasShell,
  usePageBuilderViewportMode,
  type MobilePageBuilderCanvasHandle,
} from "./mobile-page-builder-canvas";
import { isCommonPaletteColor } from "../../../../lib/shared/common-color-palette";

type BlockAlignment = "LEFT" | "CENTER" | "RIGHT";
type StyleSize = "sm" | "md" | "lg";
type StyleLayout = "full" | "box";
type StyleColorToken = string;
type StyleBackground = "none" | StyleColorToken;
type StyleBorderWidth = "none" | "thin" | "normal" | "thick";
type StyleBorderColor = "light" | "default" | "strong" | StyleColorToken;
type StyleBorderStyle = "solid" | "dashed";
type StyleSpace = "none" | "sm" | "md" | "lg";
type StyleFontSize = "sm" | "md" | "lg";
type StyleTextColor = "default" | "muted" | "primary" | StyleColorToken;
type StyleFontWeight = "normal" | "medium" | "bold";

type CommonBlockStyle = {
  size?: StyleSize;
  layout?: StyleLayout;
  background?: StyleBackground;
  border?: {
    width?: StyleBorderWidth;
    color?: StyleBorderColor;
    style?: StyleBorderStyle;
  };
  padding?: StyleSpace;
  margin?: StyleSpace;
  fontSize?: StyleFontSize;
  textColor?: StyleTextColor;
  fontWeight?: StyleFontWeight;
};

type BlockType = "TITLE" | "BUTTON" | "LINK" | "SLIDE_CARDS" | "NOTICE" | "SPACER" | "DIVIDER";
type SectionTypeFilter = "ALL" | BlockType;
type SectionPresetType = "TITLE_LINK" | "TITLE_BUTTON" | "TITLE_SLIDE_CARDS";

type TitleBlock = {
  id: string;
  type: "TITLE";
  data: {
    text: string;
    alignment: BlockAlignment;
    style?: CommonBlockStyle;
  };
};

type ButtonBlock = {
  id: string;
  type: "BUTTON";
  data: {
    label: string;
    link: string;
    role: "NAVIGATE" | "SORT_TRIGGER";
    alignment: BlockAlignment;
    style?: CommonBlockStyle;
  };
};

type LinkBlock = {
  id: string;
  type: "LINK";
  data: {
    text: string;
    href: string;
    alignment: BlockAlignment;
    style?: CommonBlockStyle;
  };
};

type SlideCardsBlock = {
  id: string;
  type: "SLIDE_CARDS";
  data: {
    cardSourceType: "TOURNAMENT_SNAPSHOT" | "VENUE_SNAPSHOT";
    sortType: "DEADLINE" | "DISTANCE" | "BILLIARD_ONLY" | "MIXED";
    sortTypeCategory: "DEFAULT" | "CONDITIONAL";
    itemLimit: number;
    alignment: BlockAlignment;
    cardLayout?: "vertical" | "horizontal";
    direction?: "vertical" | "horizontal";
    peekRatio?: number;
    style?: CommonBlockStyle;
  };
};

type NoticeBlock = {
  id: string;
  type: "NOTICE";
  data: {
    text: string;
    link?: string;
    visible?: boolean;
    style?: CommonBlockStyle;
  };
};

type SpacerBlock = {
  id: string;
  type: "SPACER";
  data: {
    size: number;
    style?: CommonBlockStyle;
  };
};

type DividerBlock = {
  id: string;
  type: "DIVIDER";
  data: {
    lineStyle: "SOLID";
    style?: CommonBlockStyle;
  };
};

export type PageBuilderBlock =
  | TitleBlock
  | ButtonBlock
  | LinkBlock
  | SlideCardsBlock
  | NoticeBlock
  | SpacerBlock
  | DividerBlock;

export type PageBuilderSection = {
  id: string;
  order: number;
  name: string;
  blocks: PageBuilderBlock[];
};

const DEFAULT_PAGE_BUILDER_PAGE_ID = "home";
const PAGE_ID_PRESETS = [
  { pageId: "home", label: "메인" },
  { pageId: "about", label: "소개" },
  { pageId: "tournaments", label: "대회안내" },
  { pageId: "venues", label: "당구장안내" },
] as const;
const INSERT_BLOCK_TYPE_OPTIONS: Array<{ type: BlockType; label: string }> = [
  { type: "TITLE", label: "제목" },
  { type: "BUTTON", label: "버튼" },
  { type: "LINK", label: "링크" },
  { type: "SLIDE_CARDS", label: "슬라이드 카드" },
  { type: "NOTICE", label: "공지" },
  { type: "SPACER", label: "여백" },
  { type: "DIVIDER", label: "구분선" },
];
const SECTION_PRESET_OPTIONS: Array<{ type: SectionPresetType; label: string }> = [
  { type: "TITLE_LINK", label: "제목 + 링크" },
  { type: "TITLE_BUTTON", label: "제목 + 버튼" },
  { type: "TITLE_SLIDE_CARDS", label: "제목 + 슬라이드 카드" },
];
const SECTION_PRESET_QUICK_BUTTONS: Array<{ type: SectionPresetType; label: string }> = [
  { type: "TITLE_LINK", label: "링크 섹션" },
  { type: "TITLE_BUTTON", label: "버튼 섹션" },
  { type: "TITLE_SLIDE_CARDS", label: "카드 섹션" },
];
const INITIAL_SECTION_ID = "section-initial";
const INITIAL_TITLE_BLOCK_ID = "block-initial-title";


function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withReorderedSections(sections: PageBuilderSection[]): PageBuilderSection[] {
  return sections.map((section, index) => ({
    ...section,
    order: index + 1,
  }));
}

function createDefaultSection(nextOrder: number): PageBuilderSection {
  return {
    id: createId("section"),
    order: nextOrder,
    name: "",
    blocks: [
      {
        id: createId("block"),
        type: "TITLE",
        data: { text: "새 섹션 제목", alignment: "LEFT" },
      },
    ],
  };
}

function createInitialDefaultSection(nextOrder: number): PageBuilderSection {
  return {
    id: INITIAL_SECTION_ID,
    order: nextOrder,
    name: "",
    blocks: [
      {
        id: INITIAL_TITLE_BLOCK_ID,
        type: "TITLE",
        data: { text: "새 섹션 제목", alignment: "LEFT" },
      },
    ],
  };
}

function createEmptySection(nextOrder: number): PageBuilderSection {
  return {
    id: createId("section"),
    order: nextOrder,
    name: "",
    blocks: [],
  };
}

function createSectionByPreset(nextOrder: number, presetType: SectionPresetType): PageBuilderSection {
  if (presetType === "TITLE_LINK") {
    return {
      id: createId("section"),
      order: nextOrder,
      name: "링크 섹션",
      blocks: [
        {
          id: createId("block"),
          type: "TITLE",
          data: { text: "섹션 제목", alignment: "LEFT" },
        },
        {
          id: createId("block"),
          type: "LINK",
          data: { text: "자세히 보기", href: "/site", alignment: "LEFT" },
        },
      ],
    };
  }
  if (presetType === "TITLE_BUTTON") {
    return {
      id: createId("section"),
      order: nextOrder,
      name: "버튼 섹션",
      blocks: [
        {
          id: createId("block"),
          type: "TITLE",
          data: { text: "섹션 제목", alignment: "LEFT" },
        },
        {
          id: createId("block"),
          type: "BUTTON",
          data: { label: "버튼", link: "/site", role: "NAVIGATE", alignment: "LEFT" },
        },
      ],
    };
  }
  return {
    id: createId("section"),
    order: nextOrder,
    name: "카드 섹션",
    blocks: [
      {
        id: createId("block"),
        type: "TITLE",
        data: { text: "섹션 제목", alignment: "LEFT" },
      },
      {
        id: createId("block"),
        type: "SLIDE_CARDS",
        data: {
          cardSourceType: "TOURNAMENT_SNAPSHOT",
          sortType: "DEADLINE",
          sortTypeCategory: "DEFAULT",
          itemLimit: 6,
          alignment: "LEFT",
        },
      },
    ],
  };
}

function createBlockByType(type: BlockType): PageBuilderBlock {
  if (type === "TITLE") {
    return {
      id: createId("block"),
      type: "TITLE",
      data: { text: "제목 텍스트", alignment: "LEFT", style: undefined },
    };
  }
  if (type === "BUTTON") {
    return {
      id: createId("block"),
      type: "BUTTON",
      data: { label: "버튼 라벨", link: "/site", role: "NAVIGATE", alignment: "LEFT", style: undefined },
    };
  }
  if (type === "LINK") {
    return {
      id: createId("block"),
      type: "LINK",
      data: {
        text: "전체대회보기 →",
        href: "/site/tournaments",
        alignment: "LEFT",
        style: undefined,
      },
    };
  }
  if (type === "SPACER") {
    return {
      id: createId("block"),
      type: "SPACER",
      data: {
        size: 24,
        style: undefined,
      },
    };
  }
  if (type === "NOTICE") {
    return {
      id: createId("block"),
      type: "NOTICE",
      data: {
        text: "공지 내용을 입력하세요.",
        link: "",
        visible: true,
        style: undefined,
      },
    };
  }
  if (type === "DIVIDER") {
    return {
      id: createId("block"),
      type: "DIVIDER",
      data: {
        lineStyle: "SOLID",
        style: undefined,
      },
    };
  }
  return {
    id: createId("block"),
    type: "SLIDE_CARDS",
    data: {
      cardSourceType: "TOURNAMENT_SNAPSHOT",
      sortType: "DEADLINE",
      sortTypeCategory: "DEFAULT",
      itemLimit: 6,
      alignment: "LEFT",
        style: undefined,
    },
  };
}

function cloneBlockWithNewId(block: PageBuilderBlock): PageBuilderBlock {
  if (block.type === "TITLE") {
    return {
      id: createId("block"),
      type: "TITLE",
      data: {
        text: block.data.text,
        alignment: block.data.alignment,
        style: block.data.style,
      },
    };
  }
  if (block.type === "BUTTON") {
    return {
      id: createId("block"),
      type: "BUTTON",
      data: {
        label: block.data.label,
        link: block.data.link,
        role: block.data.role,
        alignment: block.data.alignment,
        style: block.data.style,
      },
    };
  }
  if (block.type === "LINK") {
    return {
      id: createId("block"),
      type: "LINK",
      data: {
        text: block.data.text,
        href: block.data.href,
        alignment: block.data.alignment,
        style: block.data.style,
      },
    };
  }
  if (block.type === "SLIDE_CARDS") {
    return {
      id: createId("block"),
      type: "SLIDE_CARDS",
      data: {
        cardSourceType: block.data.cardSourceType,
        sortType: block.data.sortType,
        sortTypeCategory: block.data.sortTypeCategory,
        itemLimit: block.data.itemLimit,
        alignment: block.data.alignment,
        cardLayout: block.data.cardLayout,
        direction: block.data.direction,
        peekRatio: block.data.peekRatio,
        style: block.data.style,
      },
    };
  }
  if (block.type === "NOTICE") {
    return {
      id: createId("block"),
      type: "NOTICE",
      data: {
        text: block.data.text,
        link: block.data.link,
        visible: block.data.visible,
        style: block.data.style,
      },
    };
  }
  if (block.type === "SPACER") {
    return {
      id: createId("block"),
      type: "SPACER",
      data: {
        size: block.data.size,
        style: block.data.style,
      },
    };
  }
  return {
    id: createId("block"),
    type: "DIVIDER",
    data: {
      lineStyle: block.data.lineStyle,
      style: block.data.style,
    },
  };
}

function getAllowedSortTypesBySource(
  cardSourceType: SlideCardsBlock["data"]["cardSourceType"]
): Array<SlideCardsBlock["data"]["sortType"]> {
  if (cardSourceType === "TOURNAMENT_SNAPSHOT") {
    return ["DEADLINE", "DISTANCE"];
  }
  return ["BILLIARD_ONLY", "MIXED", "DISTANCE"];
}

function getSortTypeCategory(
  sortType: SlideCardsBlock["data"]["sortType"]
): SlideCardsBlock["data"]["sortTypeCategory"] {
  return sortType === "DISTANCE" ? "CONDITIONAL" : "DEFAULT";
}

function parseAlignment(value: unknown): BlockAlignment {
  if (value === "CENTER") return "CENTER";
  if (value === "RIGHT") return "RIGHT";
  return "LEFT";
}

function normalizeBlockStyle(input: unknown): CommonBlockStyle | undefined {
  if (!input || typeof input !== "object") return undefined;
  const row = input as {
    size?: unknown;
    layout?: unknown;
    background?: unknown;
    border?: { width?: unknown; color?: unknown; style?: unknown } | unknown;
    padding?: unknown;
    margin?: unknown;
    fontSize?: unknown;
    textColor?: unknown;
    fontWeight?: unknown;
  };
  const style: CommonBlockStyle = {};
  if (row.size === "sm" || row.size === "md" || row.size === "lg") style.size = row.size;
  if (row.layout === "full" || row.layout === "box") style.layout = row.layout;
  if (row.background === "none" || row.background === "light" || row.background === "accent" || isCommonPaletteColor(row.background)) {
    style.background = row.background;
  }
  if (row.padding === "none" || row.padding === "sm" || row.padding === "md" || row.padding === "lg") {
    style.padding = row.padding;
  }
  if (row.margin === "none" || row.margin === "sm" || row.margin === "md" || row.margin === "lg") {
    style.margin = row.margin;
  }
  if (row.fontSize === "sm" || row.fontSize === "md" || row.fontSize === "lg") style.fontSize = row.fontSize;
  if (row.textColor === "default" || row.textColor === "muted" || row.textColor === "primary" || isCommonPaletteColor(row.textColor)) {
    style.textColor = row.textColor;
  }
  if (row.fontWeight === "normal" || row.fontWeight === "medium" || row.fontWeight === "bold") {
    style.fontWeight = row.fontWeight;
  }
  if (row.border && typeof row.border === "object") {
    const borderRow = row.border as { width?: unknown; color?: unknown; style?: unknown };
    const border: NonNullable<CommonBlockStyle["border"]> = {};
    if (
      borderRow.width === "none" ||
      borderRow.width === "thin" ||
      borderRow.width === "normal" ||
      borderRow.width === "thick"
    ) {
      border.width = borderRow.width;
    }
    if (borderRow.color === "light" || borderRow.color === "default" || borderRow.color === "strong" || isCommonPaletteColor(borderRow.color)) {
      border.color = borderRow.color;
    }
    if (borderRow.style === "solid" || borderRow.style === "dashed") {
      border.style = borderRow.style;
    }
    if (Object.keys(border).length > 0) {
      style.border = border;
    }
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function summarizeText(value: string, fallback: string, maxLength: number = 24): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function normalizeDraftBlock(input: unknown): PageBuilderBlock | null {
  if (!input || typeof input !== "object") return null;
  const item = input as { id?: unknown; type?: unknown; data?: unknown };
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const type = typeof item.type === "string" ? item.type : "";
  const data = item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : {};
  if (!id) return null;

  if (type === "TITLE") {
    return {
      id,
      type: "TITLE",
      data: {
        text: typeof data.text === "string" ? data.text : "제목 텍스트",
        alignment: parseAlignment(data.alignment),
        style: normalizeBlockStyle(data.style),
      },
    };
  }
  if (type === "BUTTON") {
    const role = data.role === "SORT_TRIGGER" ? "SORT_TRIGGER" : "NAVIGATE";
    return {
      id,
      type: "BUTTON",
      data: {
        label: typeof data.label === "string" ? data.label : "버튼 라벨",
        link: typeof data.link === "string" ? data.link : "/site",
        role,
        alignment: parseAlignment(data.alignment),
        style: normalizeBlockStyle(data.style),
      },
    };
  }
  if (type === "LINK") {
    return {
      id,
      type: "LINK",
      data: {
        text: typeof data.text === "string" ? data.text : "전체대회보기 →",
        href: typeof data.href === "string" ? data.href : "/site/tournaments",
        alignment: parseAlignment(data.alignment),
        style: normalizeBlockStyle(data.style),
      },
    };
  }
  if (type === "SLIDE_CARDS") {
    const cardSourceType =
      data.cardSourceType === "VENUE_SNAPSHOT" ? "VENUE_SNAPSHOT" : "TOURNAMENT_SNAPSHOT";
    const allowedSortTypes = getAllowedSortTypesBySource(cardSourceType);
    const requestedSortType = typeof data.sortType === "string" ? data.sortType : "";
    const sortType = allowedSortTypes.includes(
      requestedSortType as SlideCardsBlock["data"]["sortType"]
    )
      ? (requestedSortType as SlideCardsBlock["data"]["sortType"])
      : allowedSortTypes[0];
    const parsedLimit = Number.parseInt(String(data.itemLimit ?? 6), 10);
    const itemLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(30, parsedLimit)) : 6;
    return {
      id,
      type: "SLIDE_CARDS",
      data: {
        cardSourceType,
        sortType,
        sortTypeCategory: getSortTypeCategory(sortType),
        itemLimit,
        alignment: parseAlignment(data.alignment),
        style: normalizeBlockStyle(data.style),
        cardLayout:
          data.cardLayout === "vertical" || data.cardLayout === "horizontal"
            ? data.cardLayout
            : undefined,
        direction:
          data.direction === "vertical" || data.direction === "horizontal"
            ? data.direction
            : undefined,
        peekRatio:
          Number.isFinite(Number(data.peekRatio))
            ? Math.max(0, Math.min(0.3, Number(data.peekRatio)))
            : undefined,
      },
    };
  }
  if (type === "SPACER") {
    const parsed = Number.parseInt(String(data.size ?? 24), 10);
    const size = Number.isFinite(parsed) ? Math.max(4, Math.min(120, parsed)) : 24;
    return {
      id,
      type: "SPACER",
      data: { size, style: normalizeBlockStyle(data.style) },
    };
  }
  if (type === "NOTICE") {
    const topLevelText = (item as { text?: unknown }).text;
    const topLevelLink = (item as { link?: unknown }).link;
    const topLevelVisible = (item as { visible?: unknown }).visible;
    const text = typeof data.text === "string" ? data.text : typeof topLevelText === "string" ? topLevelText : "";
    const link =
      typeof data.link === "string"
        ? data.link
        : typeof topLevelLink === "string"
          ? topLevelLink
          : "";
    const visibleRaw =
      typeof data.visible === "boolean"
        ? data.visible
        : typeof topLevelVisible === "boolean"
          ? topLevelVisible
          : true;
    return {
      id,
      type: "NOTICE",
      data: {
        text,
        link,
        visible: visibleRaw,
        style: normalizeBlockStyle(data.style),
      },
    };
  }
  if (type === "DIVIDER") {
    return {
      id,
      type: "DIVIDER",
      data: { lineStyle: "SOLID", style: normalizeBlockStyle(data.style) },
    };
  }
  return null;
}

function normalizeDraftSections(input: unknown): PageBuilderSection[] {
  if (!Array.isArray(input)) return [];
  const sections = input
    .map((section, index) => {
      if (!section || typeof section !== "object") return null;
      const row = section as { id?: unknown; order?: unknown; name?: unknown; blocks?: unknown };
      const id = typeof row.id === "string" ? row.id.trim() : "";
      if (!id) return null;
      const name = typeof row.name === "string" ? row.name : "";
      const blocks = Array.isArray(row.blocks)
        ? row.blocks
            .map((block) => normalizeDraftBlock(block))
            .filter((block): block is PageBuilderBlock => block !== null)
        : [];
      const orderRaw = Number(row.order);
      const order =
        Number.isFinite(orderRaw) && orderRaw > 0 ? Math.floor(orderRaw) : index + 1;
      return { id, order, name, blocks };
    })
    .filter((section): section is PageBuilderSection => section !== null)
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }));
  return sections;
}

function serializeSections(sections: PageBuilderSection[]): string {
  return JSON.stringify(sections);
}

function PlatformSitePagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sections, setSections] = useState<PageBuilderSection[]>([createInitialDefaultSection(1)]);
  const [lastSavedDraftSections, setLastSavedDraftSections] = useState<PageBuilderSection[]>([]);
  const [publishedSections, setPublishedSections] = useState<PageBuilderSection[]>([]);
  const [hasDraftRecord, setHasDraftRecord] = useState(false);
  const [hasPublishedRecord, setHasPublishedRecord] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [insertSelector, setInsertSelector] = useState<{ sectionId: string; insertIndex: number } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [sectionTypeFilter, setSectionTypeFilter] = useState<SectionTypeFilter>("ALL");
  const [selectedSectionPreset, setSelectedSectionPreset] = useState<SectionPresetType>("TITLE_LINK");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [customPageIdInput, setCustomPageIdInput] = useState("");
  const [recentSectionId, setRecentSectionId] = useState<string | null>(null);
  const [recentBlockId, setRecentBlockId] = useState<string | null>(null);
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const previewSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewSyncedSectionsRef = useRef<string>("");
  const viewportMode = usePageBuilderViewportMode();
  const mobileCanvasRef = useRef<MobilePageBuilderCanvasHandle | null>(null);
  const isMobileCanvas = viewportMode === "mobile-landscape";

  const selectedBlockMeta = useMemo(() => {
    if (!selectedBlockId) return null;
    for (const section of sections) {
      const target = section.blocks.find((block) => block.id === selectedBlockId);
      if (target) {
        return { sectionId: section.id, block: target };
      }
    }
    return null;
  }, [sections, selectedBlockId]);

  const sectionCountLabel = useMemo(() => `${sections.length}개`, [sections.length]);
  const builderPageId = useMemo(() => {
    const raw = searchParams.get("pageId");
    const normalized = raw ? raw.trim() : "";
    return normalized || DEFAULT_PAGE_BUILDER_PAGE_ID;
  }, [searchParams]);
  const pageStateLabel = useMemo(() => {
    if (publishLoading) return "게시 중";
    if (saveLoading) return "초안 저장 중";
    if (loadingDraft) return "초안 불러오는 중";
    return "초안 편집 중";
  }, [loadingDraft, saveLoading, publishLoading]);
  const hasUnsavedChanges = useMemo(
    () => serializeSections(sections) !== serializeSections(lastSavedDraftSections),
    [sections, lastSavedDraftSections]
  );
  const differsFromPublished = useMemo(
    () => serializeSections(sections) !== serializeSections(publishedSections),
    [sections, publishedSections]
  );
  const isEffectivelyEmptyPage = useMemo(() => {
    if (sections.length === 0) return true;
    return sections.every((section) => section.blocks.length === 0);
  }, [sections]);
  const pageIdOptions = useMemo(() => {
    const presetPageIds: string[] = PAGE_ID_PRESETS.map((item) => item.pageId);
    if (presetPageIds.includes(builderPageId)) {
      return presetPageIds;
    }
    return [builderPageId, ...presetPageIds];
  }, [builderPageId]);

  useEffect(() => {
    async function loadDraft() {
      setLoadingDraft(true);
      setDraftMessage("");
      setSections([createInitialDefaultSection(1)]);
      setHasDraftRecord(false);
      setHasPublishedRecord(false);
      try {
        const draftResponse = await fetch(`/api/platform/site-pages/${builderPageId}/draft`);
        const draftResult = (await draftResponse.json()) as {
          draft?: { sections?: unknown } | null;
          error?: string;
        };
        if (!draftResponse.ok) {
          setDraftMessage(draftResult.error ?? "초안 불러오기에 실패했습니다.");
          return;
        }
        const loadedSections = normalizeDraftSections(draftResult.draft?.sections);
        setHasDraftRecord(Boolean(draftResult.draft));
        setLastSavedDraftSections(loadedSections);
        lastPreviewSyncedSectionsRef.current = serializeSections(loadedSections);
        setPreviewRefreshToken(Date.now());
        if (loadedSections.length > 0) {
          setSections(loadedSections);
          setDraftMessage("저장된 페이지 초안을 불러왔습니다.");
        }
        const publishedResponse = await fetch(`/api/site/pages/${builderPageId}/published`);
        const publishedResult = (await publishedResponse.json()) as {
          published?: { sections?: unknown } | null;
        };
        if (publishedResponse.ok) {
          setHasPublishedRecord(Boolean(publishedResult.published));
          setPublishedSections(normalizeDraftSections(publishedResult.published?.sections));
        } else {
          setHasPublishedRecord(false);
          setPublishedSections([]);
        }
      } catch {
        setLastSavedDraftSections([]);
        setPublishedSections([]);
        setHasDraftRecord(false);
        setHasPublishedRecord(false);
        setDraftMessage("초안 불러오기 중 오류가 발생했습니다.");
      } finally {
        setLoadingDraft(false);
      }
    }
    void loadDraft();
  }, [builderPageId]);

  useEffect(() => {
    if (loadingDraft) return;
    if (previewSyncTimeoutRef.current) {
      clearTimeout(previewSyncTimeoutRef.current);
    }
    const serializedSections = serializeSections(sections);
    if (serializedSections === lastPreviewSyncedSectionsRef.current) {
      return;
    }
    previewSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/platform/site-pages/${builderPageId}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections }),
        });
        const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
        if (!response.ok || !result?.ok) return;
        lastPreviewSyncedSectionsRef.current = serializedSections;
        setPreviewRefreshToken(Date.now());
      } catch {
        // Ignore preview sync failures; explicit save/publish flow remains unchanged.
      }
    }, 700);
    return () => {
      if (previewSyncTimeoutRef.current) {
        clearTimeout(previewSyncTimeoutRef.current);
      }
    };
  }, [builderPageId, loadingDraft, sections]);

  useEffect(() => {
    if (!selectedBlockMeta) return;
    setSelectedSectionId(selectedBlockMeta.sectionId);
  }, [selectedBlockMeta]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const handlePreviewSelect = useCallback(
    ({ sectionId, blockId }: { sectionId: string | null; blockId: string | null }) => {
      if (sectionId) {
        openOnlySection(sectionId);
        scrollToSection(sectionId);
        setSelectedSectionId(sectionId);
      }
      if (blockId) {
        setSelectedBlockId(blockId);
        setRecentBlockId(blockId);
      } else {
        setSelectedBlockId(null);
      }
    },
    []
  );

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!recentSectionId) return;
    openOnlySection(recentSectionId);
    const sectionElement = document.getElementById(`section-card-${recentSectionId}`);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const sectionNameInput = document.getElementById(`section-name-${recentSectionId}`);
    if (sectionNameInput instanceof HTMLInputElement) {
      sectionNameInput.focus();
    }
    setRecentSectionId(null);
  }, [recentSectionId]);

  useEffect(() => {
    if (!recentBlockId) return;
    const blockElement = document.getElementById(`block-card-${recentBlockId}`);
    if (blockElement) {
      blockElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const blockPrimaryInput = document.getElementById(`block-primary-input-${recentBlockId}`);
    if (
      blockPrimaryInput instanceof HTMLInputElement ||
      blockPrimaryInput instanceof HTMLSelectElement ||
      blockPrimaryInput instanceof HTMLTextAreaElement
    ) {
      blockPrimaryInput.focus();
    }
    setRecentBlockId(null);
  }, [recentBlockId]);

  useEffect(() => {
    if (sections.length === 0) return;
    const opened = sections.find((section) => expandedSections[section.id]);
    if (opened) return;
    setExpandedSections({ [sections[0].id]: true });
  }, [sections, expandedSections]);

  async function handleSaveDraft() {
    if (saveLoading) return;
    setSaveLoading(true);
    setDraftMessage("");
    try {
      const response = await fetch(`/api/platform/site-pages/${builderPageId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setDraftMessage(result.error ?? "초안 저장에 실패했습니다.");
        return;
      }
      setLastSavedDraftSections(sections);
      setHasDraftRecord(true);
      setDraftMessage("페이지 초안이 저장되었습니다.");
    } catch {
      setDraftMessage("초안 저장 중 오류가 발생했습니다.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handlePublishPage() {
    if (publishLoading) return;
    setPublishLoading(true);
    setDraftMessage("");
    try {
      const response = await fetch(`/api/platform/site-pages/${builderPageId}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setDraftMessage(result.error ?? "게시에 실패했습니다.");
        return;
      }
      setPublishedSections(sections);
      setHasPublishedRecord(true);
      setDraftMessage("페이지 게시본이 저장되었습니다.");
    } catch {
      setDraftMessage("게시 중 오류가 발생했습니다.");
    } finally {
      setPublishLoading(false);
    }
  }

  function handleAddSection() {
    const nextSection = createDefaultSection(sections.length + 1);
    setSections((prev) => [...prev, nextSection]);
    openOnlySection(nextSection.id);
    setRecentSectionId(nextSection.id);
  }

  function handleInsertSectionAt(insertIndex: number) {
    const nextSection = createEmptySection(sections.length + 1);
    setSections((prev) => {
      const boundedIndex = Math.max(0, Math.min(prev.length, Math.floor(insertIndex)));
      const next = [...prev];
      next.splice(boundedIndex, 0, nextSection);
      return withReorderedSections(next);
    });
    openOnlySection(nextSection.id);
    setRecentSectionId(nextSection.id);
  }

  function handleInsertPresetSectionAt(insertIndex: number, presetType: SectionPresetType) {
    const nextSection = createSectionByPreset(sections.length + 1, presetType);
    setSections((prev) => {
      const boundedIndex = Math.max(0, Math.min(prev.length, Math.floor(insertIndex)));
      const next = [...prev];
      next.splice(boundedIndex, 0, nextSection);
      return withReorderedSections(next);
    });
    openOnlySection(nextSection.id);
    setRecentSectionId(nextSection.id);
  }

  function handleDeleteSection(sectionId: string) {
    setSections((prev) => withReorderedSections(prev.filter((section) => section.id !== sectionId)));
    setExpandedSections((prev) => {
      if (!(sectionId in prev)) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }

  function handleDuplicateSection(sectionId: string) {
    const sourceSection = sections.find((section) => section.id === sectionId);
    if (!sourceSection) return;
    const duplicatedSection: PageBuilderSection = {
      id: createId("section"),
      order: sourceSection.order,
      name: sourceSection.name,
      blocks: sourceSection.blocks.map((block) => cloneBlockWithNewId(block)),
    };
    setSections((prev) => {
      const currentIndex = prev.findIndex((section) => section.id === sectionId);
      if (currentIndex < 0) return prev;
      const next = [...prev];
      next.splice(currentIndex + 1, 0, duplicatedSection);
      return withReorderedSections(next);
    });
    openOnlySection(duplicatedSection.id);
    setRecentSectionId(duplicatedSection.id);
  }

  function updateSectionName(sectionId: string, name: string) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          name,
        };
      })
    );
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    setSections((prev) => {
      const currentIndex = prev.findIndex((section) => section.id === sectionId);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return withReorderedSections(next);
    });
  }

  function handleAddBlock(sectionId: string, type: BlockType) {
    if (!sections.some((section) => section.id === sectionId)) return;
    const nextBlock = createBlockByType(type);
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: [...section.blocks, nextBlock],
        };
      })
    );
    openOnlySection(sectionId);
    setExpandedBlocks((prev) => ({ ...prev, [nextBlock.id]: true }));
    setRecentBlockId(nextBlock.id);
  }

  function handleInsertBlockAt(sectionId: string, insertIndex: number, type: BlockType = "TITLE") {
    if (!sections.some((section) => section.id === sectionId)) return;
    const nextBlock = createBlockByType(type);
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const boundedIndex = Math.max(0, Math.min(section.blocks.length, Math.floor(insertIndex)));
        const nextBlocks = [...section.blocks];
        nextBlocks.splice(boundedIndex, 0, nextBlock);
        return {
          ...section,
          blocks: nextBlocks,
        };
      })
    );
    setInsertSelector(null);
    openOnlySection(sectionId);
    setExpandedBlocks((prev) => ({ ...prev, [nextBlock.id]: true }));
    setRecentBlockId(nextBlock.id);
  }

  function handleDeleteBlock(sectionId: string, blockId: string) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.filter((block) => block.id !== blockId),
        };
      })
    );
    setExpandedBlocks((prev) => {
      if (!(blockId in prev)) return prev;
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
  }

  function moveBlock(sectionId: string, blockId: string, direction: "up" | "down") {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const currentIndex = section.blocks.findIndex((block) => block.id === blockId);
        if (currentIndex < 0) return section;
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= section.blocks.length) return section;
        const nextBlocks = [...section.blocks];
        const [moved] = nextBlocks.splice(currentIndex, 1);
        nextBlocks.splice(targetIndex, 0, moved);
        return {
          ...section,
          blocks: nextBlocks,
        };
      })
    );
  }

  function handleDuplicateBlock(sectionId: string, blockId: string) {
    const sourceSection = sections.find((section) => section.id === sectionId);
    if (!sourceSection) return;
    const sourceBlock = sourceSection.blocks.find((block) => block.id === blockId);
    if (!sourceBlock) return;
    const duplicatedBlock = cloneBlockWithNewId(sourceBlock);
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const currentIndex = section.blocks.findIndex((block) => block.id === blockId);
        if (currentIndex < 0) return section;
        const nextBlocks = [...section.blocks];
        nextBlocks.splice(currentIndex + 1, 0, duplicatedBlock);
        return {
          ...section,
          blocks: nextBlocks,
        };
      })
    );
    openOnlySection(sectionId);
    setExpandedBlocks((prev) => ({ ...prev, [duplicatedBlock.id]: true }));
    setRecentBlockId(duplicatedBlock.id);
  }

  function updateTitleField(
    sectionId: string,
    blockId: string,
    field: "text" | "alignment",
    value: string
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "TITLE") return block;
            if (field === "alignment") {
              return { ...block, data: { ...block.data, alignment: parseAlignment(value) } };
            }
            return { ...block, data: { ...block.data, text: value } };
          }),
        };
      })
    );
  }

  function updateButtonField(
    sectionId: string,
    blockId: string,
    field: "label" | "link" | "role" | "alignment",
    value: string
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "BUTTON") return block;
            if (field === "alignment") {
              return { ...block, data: { ...block.data, alignment: parseAlignment(value) } };
            }
            return { ...block, data: { ...block.data, [field]: value } };
          }),
        };
      })
    );
  }

  function updateLinkField(
    sectionId: string,
    blockId: string,
    field: "text" | "href" | "alignment",
    value: string
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "LINK") return block;
            if (field === "alignment") {
              return { ...block, data: { ...block.data, alignment: parseAlignment(value) } };
            }
            if (field === "text") {
              return { ...block, data: { ...block.data, text: value } };
            }
            return { ...block, data: { ...block.data, href: value } };
          }),
        };
      })
    );
  }

  function updateSlideBlockField(
    sectionId: string,
    blockId: string,
    field: "cardSourceType" | "sortType" | "itemLimit" | "alignment" | "direction" | "cardLayout",
    value: string
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "SLIDE_CARDS") return block;
            if (field === "alignment") {
              return { ...block, data: { ...block.data, alignment: parseAlignment(value) } };
            }
            if (field === "itemLimit") {
              const parsed = Number.parseInt(value, 10);
              const nextLimit = Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 1;
              return { ...block, data: { ...block.data, itemLimit: nextLimit } };
            }
            if (field === "cardSourceType") {
              const nextSourceType =
                value === "TOURNAMENT_SNAPSHOT" || value === "VENUE_SNAPSHOT"
                  ? value
                  : block.data.cardSourceType;
              const allowedSortTypes = getAllowedSortTypesBySource(nextSourceType);
              const nextSortType = allowedSortTypes.includes(block.data.sortType)
                ? block.data.sortType
                : allowedSortTypes[0];
              return {
                ...block,
                data: {
                  ...block.data,
                  cardSourceType: nextSourceType,
                  sortType: nextSortType,
                  sortTypeCategory: getSortTypeCategory(nextSortType),
                },
              };
            }
            if (field === "sortType") {
              const nextSortType =
                value === "DEADLINE" ||
                value === "DISTANCE" ||
                value === "BILLIARD_ONLY" ||
                value === "MIXED"
                  ? value
                  : block.data.sortType;
              const allowedSortTypes = getAllowedSortTypesBySource(block.data.cardSourceType);
              if (!allowedSortTypes.includes(nextSortType)) {
                return block;
              }
              return {
                ...block,
                data: {
                  ...block.data,
                  sortType: nextSortType,
                  sortTypeCategory: getSortTypeCategory(nextSortType),
                },
              };
            }
            if (field === "direction") {
              const nextDirection =
                value === "vertical" || value === "horizontal" ? value : undefined;
              if (nextDirection === "vertical") {
                const nextPeekRatio =
                  Number.isFinite(Number(block.data.peekRatio))
                    ? Math.max(0, Math.min(0.3, Number(block.data.peekRatio)))
                    : 0.15;
                return {
                  ...block,
                  data: {
                    ...block.data,
                    direction: nextDirection,
                    peekRatio: nextPeekRatio,
                  },
                };
              }
              if (nextDirection === "horizontal") {
                return {
                  ...block,
                  data: {
                    ...block.data,
                    direction: nextDirection,
                  },
                };
              }
              return {
                ...block,
                data: {
                  ...block.data,
                  direction: undefined,
                  peekRatio: undefined,
                },
              };
            }
            if (field === "cardLayout") {
              const nextLayout =
                value === "vertical" || value === "horizontal" ? value : undefined;
              return {
                ...block,
                data: {
                  ...block.data,
                  cardLayout: nextLayout,
                },
              };
            }
            return { ...block, data: { ...block.data, [field]: value } };
          }),
        };
      })
    );
  }

  function updateSpacerSize(sectionId: string, blockId: string, sizeText: string) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "SPACER") return block;
            const parsed = Number.parseInt(sizeText, 10);
            const nextSize = Number.isFinite(parsed) ? Math.max(4, Math.min(120, parsed)) : 4;
            return {
              ...block,
              data: {
                ...block.data,
                size: nextSize,
              },
            };
          }),
        };
      })
    );
  }

  function updateNoticeField(
    sectionId: string,
    blockId: string,
    field: "text" | "link" | "visible",
    value: string | boolean
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId || block.type !== "NOTICE") return block;
            if (field === "visible") {
              return { ...block, data: { ...block.data, visible: Boolean(value) } };
            }
            if (field === "text") {
              return { ...block, data: { ...block.data, text: String(value) } };
            }
            return { ...block, data: { ...block.data, link: String(value) } };
          }),
        };
      })
    );
  }

  function updateBlockStyle(
    sectionId: string,
    blockId: string,
    updater: (current: CommonBlockStyle | undefined) => CommonBlockStyle | undefined
  ) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          blocks: section.blocks.map((block) => {
            if (block.id !== blockId) return block;
            if (block.type === "TITLE") {
              return {
                ...block,
                data: {
                  ...block.data,
                  style: updater(block.data.style),
                },
              };
            }
            if (block.type === "BUTTON") {
              return {
                ...block,
                data: {
                  ...block.data,
                  style: updater(block.data.style),
                },
              };
            }
            if (block.type === "NOTICE") {
              return {
                ...block,
                data: {
                  ...block.data,
                  style: updater(block.data.style),
                },
              };
            }
            if (block.type === "DIVIDER") {
              return {
                ...block,
                data: {
                  ...block.data,
                  style: updater(block.data.style),
                },
              };
            }
            return block;
          }),
        };
      })
    );
  }

  function toggleBlockExpanded(blockId: string) {
    setExpandedBlocks((prev) => {
      const isExpanded = prev[blockId] ?? true;
      return {
        ...prev,
        [blockId]: !isExpanded,
      };
    });
  }

  function isBlockExpanded(blockId: string): boolean {
    return expandedBlocks[blockId] ?? true;
  }

  function toggleSectionExpanded(sectionId: string) {
    setExpandedSections((prev) => {
      const isExpanded = prev[sectionId] ?? false;
      if (isExpanded) return {};
      return { [sectionId]: true };
    });
  }

  function isSectionExpanded(sectionId: string): boolean {
    return expandedSections[sectionId] ?? false;
  }

  function setSectionBlocksExpanded(section: PageBuilderSection, expanded: boolean) {
    setExpandedBlocks((prev) => {
      const next = { ...prev };
      section.blocks.forEach((block) => {
        next[block.id] = expanded;
      });
      return next;
    });
  }

  function openOnlySection(sectionId: string) {
    setExpandedSections({ [sectionId]: true });
  }

  function getBlockTypeLabel(block: PageBuilderBlock): string {
    if (block.type === "TITLE") return "제목 블록";
    if (block.type === "BUTTON") return "버튼 블록";
    if (block.type === "LINK") return "링크 블록(텍스트 링크)";
    if (block.type === "SLIDE_CARDS") return "슬라이드 블록(카드 스냅샷 전용)";
    if (block.type === "NOTICE") return "공지 블록(상단 바)";
    if (block.type === "SPACER") return "여백 블록";
    return "구분선 블록";
  }

  function getBlockSummary(block: PageBuilderBlock): string {
    if (block.type === "TITLE") {
      return `제목: ${summarizeText(block.data.text, "제목 없음", 28)}`;
    }
    if (block.type === "BUTTON") {
      const label = summarizeText(block.data.label, "라벨 없음", 20);
      if (block.data.role === "SORT_TRIGGER") {
        return `라벨: ${label} / 동작: 정렬 트리거`;
      }
      return `라벨: ${label} / 링크: ${summarizeText(block.data.link, "링크 없음", 24)}`;
    }
    if (block.type === "LINK") {
      return `텍스트: ${summarizeText(block.data.text, "텍스트 없음", 20)} / 대상: ${summarizeText(block.data.href, "대상 없음", 24)}`;
    }
    if (block.type === "SLIDE_CARDS") {
      const directionLabel = block.data.direction ?? "기본";
      const layoutLabel = block.data.cardLayout ?? "세로(기본)";
      return `소스: ${block.data.cardSourceType || "없음"} / 정렬: ${block.data.sortType || "없음"} / 개수: ${block.data.itemLimit || 0} / 카드형태: ${layoutLabel} / 방향: ${directionLabel}`;
    }
    if (block.type === "NOTICE") {
      const visibleLabel = block.data.visible === false ? "숨김" : "노출";
      return `공지: ${summarizeText(block.data.text, "내용 없음", 24)} / 링크: ${summarizeText(block.data.link ?? "", "없음", 20)} / ${visibleLabel}`;
    }
    if (block.type === "SPACER") {
      return `간격: ${block.data.size ? `${block.data.size}px` : "기본 spacer"}`;
    }
    return `divider: ${block.data.lineStyle || "SOLID"}`;
  }

  function getSectionDisplayName(section: PageBuilderSection): string {
    const name = section.name.trim();
    if (name) return name;
    return `섹션 ${section.order}`;
  }

  function sectionHasBlockType(section: PageBuilderSection, blockType: BlockType): boolean {
    return section.blocks.some((block) => block.type === blockType);
  }

  function getSectionBlockTypeSummary(section: PageBuilderSection): string {
    if (section.blocks.length === 0) return "빈 섹션";
    const orderedTypes: BlockType[] = ["TITLE", "BUTTON", "LINK", "SLIDE_CARDS", "NOTICE", "SPACER", "DIVIDER"];
    const countByType: Record<BlockType, number> = {
      TITLE: 0,
      BUTTON: 0,
      LINK: 0,
      SLIDE_CARDS: 0,
      NOTICE: 0,
      SPACER: 0,
      DIVIDER: 0,
    };
    section.blocks.forEach((block) => {
      countByType[block.type] += 1;
    });
    return orderedTypes
      .filter((type) => countByType[type] > 0)
      .map((type) => {
        const label =
          type === "TITLE"
            ? "제목"
            : type === "BUTTON"
              ? "버튼"
              : type === "LINK"
                ? "링크"
                : type === "SLIDE_CARDS"
                  ? "슬라이드"
                  : type === "NOTICE"
                    ? "공지"
                    : type === "SPACER"
                      ? "여백"
                      : "구분선";
        return countByType[type] > 1 ? `${label} x${countByType[type]}` : label;
      })
      .join(" · ");
  }

  function scrollToSection(sectionId: string) {
    const sectionElement = document.getElementById(`section-card-${sectionId}`);
    if (!sectionElement) return;
    sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getPageIdOptionLabel(pageId: string): string {
    const preset = PAGE_ID_PRESETS.find((item) => item.pageId === pageId);
    const description = preset?.label ?? "사용자 지정";
    return `${pageId} — ${description}`;
  }

  function getPreviewPathByPageId(pageId: string): string | null {
    if (pageId === "home") return "/site";
    return null;
  }

  function confirmUnsavedLeave(): boolean {
    if (!hasUnsavedChanges) return true;
    return window.confirm("미저장 변경이 있습니다. 페이지를 떠나시겠습니까?");
  }

  function confirmLeaveWhenUnsaved(event: MouseEvent<HTMLAnchorElement>) {
    if (confirmUnsavedLeave()) return;
    event.preventDefault();
  }

  function handlePageIdChange(nextPageId: string) {
    const normalized = nextPageId.trim();
    if (!normalized || normalized === builderPageId) return;
    if (!confirmUnsavedLeave()) return;
    router.push(`/platform/site/pages?pageId=${encodeURIComponent(normalized)}`);
  }

  function handleOpenCustomPageId() {
    handlePageIdChange(customPageIdInput);
  }

  const previewPath = getPreviewPathByPageId(builderPageId);

  const styleSelect = {
    size: ["sm", "md", "lg"] as const,
    layout: ["full", "box"] as const,
    borderWidth: ["none", "thin", "normal", "thick"] as const,
    borderStyle: ["solid", "dashed"] as const,
    space: ["none", "sm", "md", "lg"] as const,
    fontSize: ["sm", "md", "lg"] as const,
    fontWeight: ["normal", "medium", "bold"] as const,
  };

  function renderStyleControls(
    sectionId: string,
    blockId: string,
    style: CommonBlockStyle | undefined,
    options?: { borderColorLabel?: string }
  ) {
    const borderColorLabel = options?.borderColorLabel ?? "테두리 색";
    return (
      <div className="v3-stack">
        <p className="v3-muted" style={{ margin: 0, fontWeight: 700 }}>
          외형
        </p>
        <label className="v3-stack">
          <span>크기</span>
          <select
            value={style?.size ?? ""}
            onChange={(event) =>
              updateBlockStyle(sectionId, blockId, (prev) => ({
                ...(prev ?? {}),
                size: event.target.value ? (event.target.value as StyleSize) : undefined,
              }))
            }
            style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            <option value="">기본</option>
            {styleSelect.size.map((option) => (
              <option key={`${blockId}-size-${option}`} value={option}>
                {option === "sm" ? "작게" : option === "md" ? "기본" : "크게"}
              </option>
            ))}
          </select>
        </label>
        <label className="v3-stack">
          <span>형태</span>
          <select
            value={style?.layout ?? ""}
            onChange={(event) =>
              updateBlockStyle(sectionId, blockId, (prev) => ({
                ...(prev ?? {}),
                layout: event.target.value ? (event.target.value as StyleLayout) : undefined,
              }))
            }
            style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            <option value="">기본</option>
            {styleSelect.layout.map((option) => (
              <option key={`${blockId}-layout-${option}`} value={option}>
                {option === "full" ? "화면 채움" : "박스"}
              </option>
            ))}
          </select>
        </label>
        <label className="v3-stack">
          <span>배경</span>
          <ColorPalettePicker
            label="배경 선택"
            value={style?.background ?? ""}
            onChange={(nextValue) =>
              updateBlockStyle(sectionId, blockId, (prev) => ({
                ...(prev ?? {}),
                background: nextValue ? (nextValue as StyleBackground) : undefined,
              }))
            }
            defaultLabel="기본"
            noneLabel="없음"
            showNoneOption
            presets={[
              { value: "light", label: "연한", hex: "#f8fafc" },
              { value: "accent", label: "강조", hex: "#dbeafe" },
            ]}
          />
        </label>
        <div className="v3-row" style={{ gap: "0.6rem", alignItems: "flex-end" }}>
          <label className="v3-stack">
            <span>테두리 두께</span>
            <select
              value={style?.border?.width ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  border: {
                    ...(prev?.border ?? {}),
                    width: event.target.value ? (event.target.value as StyleBorderWidth) : undefined,
                  },
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.borderWidth.map((option) => (
                <option key={`${blockId}-border-width-${option}`} value={option}>
                  {option === "none" ? "없음" : option === "thin" ? "얇게" : option === "normal" ? "보통" : "두껍게"}
                </option>
              ))}
            </select>
          </label>
          <label className="v3-stack">
            <span>{borderColorLabel}</span>
            <ColorPalettePicker
              label={`${borderColorLabel} 선택`}
              value={style?.border?.color ?? ""}
              onChange={(nextValue) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  border: {
                    ...(prev?.border ?? {}),
                    color: nextValue ? (nextValue as StyleBorderColor) : undefined,
                  },
                }))
              }
              defaultLabel="기본"
              presets={[
                { value: "light", label: "연한", hex: "#e5e7eb" },
                { value: "default", label: "기본선", hex: "#cbd5e1" },
                { value: "strong", label: "진한", hex: "#334155" },
              ]}
            />
          </label>
          <label className="v3-stack">
            <span>테두리 종류</span>
            <select
              value={style?.border?.style ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  border: {
                    ...(prev?.border ?? {}),
                    style: event.target.value ? (event.target.value as StyleBorderStyle) : undefined,
                  },
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.borderStyle.map((option) => (
                <option key={`${blockId}-border-style-${option}`} value={option}>
                  {option === "solid" ? "실선" : "점선"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="v3-muted" style={{ margin: 0, fontWeight: 700 }}>
          텍스트
        </p>
        <div className="v3-row" style={{ gap: "0.6rem", alignItems: "flex-end" }}>
          <label className="v3-stack">
            <span>글자 크기</span>
            <select
              value={style?.fontSize ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  fontSize: event.target.value ? (event.target.value as StyleFontSize) : undefined,
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.fontSize.map((option) => (
                <option key={`${blockId}-font-size-${option}`} value={option}>
                  {option === "sm" ? "작게" : option === "md" ? "기본" : "크게"}
                </option>
              ))}
            </select>
          </label>
          <label className="v3-stack">
            <span>글자 색</span>
            <ColorPalettePicker
              label="글자 색 선택"
              value={style?.textColor ?? ""}
              onChange={(nextValue) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  textColor: nextValue ? (nextValue as StyleTextColor) : undefined,
                }))
              }
              defaultLabel="기본"
              presets={[
                { value: "muted", label: "연한", hex: "#6b7280" },
                { value: "primary", label: "강조", hex: "#1d4ed8" },
              ]}
            />
          </label>
          <label className="v3-stack">
            <span>글자 굵기</span>
            <select
              value={style?.fontWeight ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  fontWeight: event.target.value ? (event.target.value as StyleFontWeight) : undefined,
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.fontWeight.map((option) => (
                <option key={`${blockId}-font-weight-${option}`} value={option}>
                  {option === "normal" ? "기본" : option === "medium" ? "중간" : "굵게"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="v3-muted" style={{ margin: 0, fontWeight: 700 }}>
          여백
        </p>
        <div className="v3-row" style={{ gap: "0.6rem", alignItems: "flex-end" }}>
          <label className="v3-stack">
            <span>안쪽 여백</span>
            <select
              value={style?.padding ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  padding: event.target.value ? (event.target.value as StyleSpace) : undefined,
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.space.map((option) => (
                <option key={`${blockId}-padding-${option}`} value={option}>
                  {option === "none" ? "없음" : option === "sm" ? "작게" : option === "md" ? "기본" : "크게"}
                </option>
              ))}
            </select>
          </label>
          <label className="v3-stack">
            <span>바깥 여백</span>
            <select
              value={style?.margin ?? ""}
              onChange={(event) =>
                updateBlockStyle(sectionId, blockId, (prev) => ({
                  ...(prev ?? {}),
                  margin: event.target.value ? (event.target.value as StyleSpace) : undefined,
                }))
              }
              style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
            >
              <option value="">기본</option>
              {styleSelect.space.map((option) => (
                <option key={`${blockId}-margin-${option}`} value={option}>
                  {option === "none" ? "없음" : option === "sm" ? "작게" : option === "md" ? "기본" : "크게"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
  }
  function renderQuickPresetInsertButtons(insertIndex: number) {
    return (
      <div className="v3-row">
        {SECTION_PRESET_QUICK_BUTTONS.map((preset) => (
          <button
            key={`quick-preset-${insertIndex}-${preset.type}`}
            type="button"
            className="v3-btn"
            onClick={() => handleInsertPresetSectionAt(insertIndex, preset.type)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  }

  if (viewportMode === "mobile-portrait") {
    return (
      <main
        className="v3-page v3-stack platform-page-builder-fullwidth"
        style={{
          width: "100%",
          maxWidth: "none",
          margin: 0,
          padding: 0,
          height: "100vh",
          overflow: "hidden",
          background: "#ffffff",
        }}
      />
    );
  }

  return (
    <main
      className={`${isMobileCanvas ? "platform-page-builder-root--mobile-canvas " : ""}v3-page v3-stack platform-page-builder-fullwidth`}
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        paddingTop: "5.2rem",
        height: "100vh",
        overflow: "hidden",
        ...(isMobileCanvas
          ? { display: "flex", flexDirection: "column" as const, minHeight: 0 }
          : {}),
      }}
    >
      <div className="platform-page-builder-topbar">
        <div className="platform-page-builder-topbar-inner">
          <ul className="platform-page-builder-topbar-summary">
            <li>{builderPageId} ({getPageIdOptionLabel(builderPageId)})</li>
            <li>{differsFromPublished ? "게시본과 다름" : "게시본과 동일"}</li>
            <li>섹션 {sectionCountLabel}</li>
          </ul>
          <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
            {isMobileCanvas ? (
              <>
                <button
                  type="button"
                  className="v3-btn"
                  aria-label="캔버스 축소"
                  onClick={() => mobileCanvasRef.current?.zoomOut()}
                >
                  −
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  aria-label="캔버스 확대"
                  onClick={() => mobileCanvasRef.current?.zoomIn()}
                >
                  +
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  onClick={() => mobileCanvasRef.current?.resetToDefaultScale()}
                >
                  기본
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  onClick={() => mobileCanvasRef.current?.setScale100()}
                >
                  100%
                </button>
              </>
            ) : null}
            <button type="button" className="v3-btn" disabled={saveLoading} onClick={handleSaveDraft}>
              {saveLoading ? "초안 저장 중..." : "초안 저장"}
            </button>
            <button type="button" className="v3-btn" disabled={publishLoading} onClick={handlePublishPage}>
              {publishLoading ? "게시 중..." : "게시"}
            </button>
          </div>
        </div>
      </div>
      <PageBuilderCanvasShell enabled={isMobileCanvas} canvasRef={mobileCanvasRef}>
      <div
        id="layout-fixed"
        className={`platform-page-builder-workspace${isMobileCanvas ? " platform-page-builder-workspace--in-canvas" : ""}`}
      >
        <aside className="v3-box v3-stack platform-page-builder-settings" onWheelCapture={(event) => event.stopPropagation()}>
          <h2 className="v3-h2" style={{ marginBottom: 0 }}>
            선택 블록 설정
          </h2>
          {!selectedBlockMeta ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              가운데 구조 영역에서 블록을 선택하세요.
            </p>
          ) : (
            <div className="v3-stack">
              <p className="v3-muted" style={{ margin: 0 }}>
                {getBlockTypeLabel(selectedBlockMeta.block)}
              </p>
              {selectedBlockMeta.block.type === "TITLE" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>제목 텍스트</span>
                    <input
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.text}
                      onChange={(event) =>
                        updateTitleField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "text",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>정렬</span>
                    <select
                      value={selectedBlockMeta.block.data.alignment}
                      onChange={(event) =>
                        updateTitleField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "alignment",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="LEFT">왼쪽</option>
                      <option value="CENTER">가운데</option>
                      <option value="RIGHT">오른쪽</option>
                    </select>
                  </label>
                  {renderStyleControls(
                    selectedBlockMeta.sectionId,
                    selectedBlockMeta.block.id,
                    selectedBlockMeta.block.data.style,
                    { borderColorLabel: "선색" }
                  )}
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "BUTTON" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>버튼 라벨</span>
                    <input
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.label}
                      onChange={(event) =>
                        updateButtonField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "label",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>이동 링크</span>
                    <input
                      value={selectedBlockMeta.block.data.link}
                      onChange={(event) =>
                        updateButtonField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "link",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>동작</span>
                    <select
                      value={selectedBlockMeta.block.data.role}
                      onChange={(event) =>
                        updateButtonField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "role",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="NAVIGATE">일반 이동</option>
                      <option value="SORT_TRIGGER">정렬 트리거</option>
                    </select>
                  </label>
                  <label className="v3-stack">
                    <span>정렬</span>
                    <select
                      value={selectedBlockMeta.block.data.alignment}
                      onChange={(event) =>
                        updateButtonField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "alignment",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="LEFT">왼쪽</option>
                      <option value="CENTER">가운데</option>
                      <option value="RIGHT">오른쪽</option>
                    </select>
                  </label>
                  <label className="v3-stack">
                    <span>크기</span>
                    <select
                      value={selectedBlockMeta.block.data.style?.size ?? ""}
                      onChange={(event) =>
                        updateBlockStyle(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, (prev) => ({
                          ...(prev ?? {}),
                          size: event.target.value ? (event.target.value as StyleSize) : undefined,
                        }))
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="">기본</option>
                      {styleSelect.size.map((option) => (
                        <option key={`${selectedBlockMeta.block.id}-size-${option}`} value={option}>
                          {option === "sm" ? "작게" : option === "md" ? "보통" : "크게"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {renderStyleControls(
                    selectedBlockMeta.sectionId,
                    selectedBlockMeta.block.id,
                    selectedBlockMeta.block.data.style
                  )}
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "LINK" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>링크 텍스트</span>
                    <input
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.text}
                      onChange={(event) =>
                        updateLinkField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "text",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>링크 주소</span>
                    <input
                      value={selectedBlockMeta.block.data.href}
                      onChange={(event) =>
                        updateLinkField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "href",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>정렬</span>
                    <select
                      value={selectedBlockMeta.block.data.alignment}
                      onChange={(event) =>
                        updateLinkField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "alignment",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="LEFT">왼쪽</option>
                      <option value="CENTER">가운데</option>
                      <option value="RIGHT">오른쪽</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "SLIDE_CARDS" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>카드 소스</span>
                    <select
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.cardSourceType}
                      onChange={(event) =>
                        updateSlideBlockField(
                          selectedBlockMeta.sectionId,
                          selectedBlockMeta.block.id,
                          "cardSourceType",
                          event.target.value
                        )
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="TOURNAMENT_SNAPSHOT">대회 스냅샷</option>
                      <option value="VENUE_SNAPSHOT">당구장 스냅샷</option>
                    </select>
                  </label>
                  <label className="v3-stack">
                    <span>정렬 방식</span>
                    <select
                      value={selectedBlockMeta.block.data.sortType}
                      onChange={(event) =>
                        updateSlideBlockField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "sortType", event.target.value)
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      {getAllowedSortTypesBySource(selectedBlockMeta.block.data.cardSourceType).map((sortType) => (
                        <option key={`${selectedBlockMeta.block.id}-${sortType}`} value={sortType}>
                          {sortType === "DEADLINE"
                            ? "마감순"
                            : sortType === "DISTANCE"
                              ? "거리순"
                              : sortType === "BILLIARD_ONLY"
                                ? "대대 전용"
                                : "복합"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="v3-stack">
                    <span>최대 개수</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={selectedBlockMeta.block.data.itemLimit}
                      onChange={(event) =>
                        updateSlideBlockField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "itemLimit", event.target.value)
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>정렬</span>
                    <select
                      value={selectedBlockMeta.block.data.alignment}
                      onChange={(event) =>
                        updateSlideBlockField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "alignment", event.target.value)
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="LEFT">왼쪽</option>
                      <option value="CENTER">가운데</option>
                      <option value="RIGHT">오른쪽</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "NOTICE" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>공지 내용</span>
                    <input
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.text}
                      onChange={(event) =>
                        updateNoticeField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "text", event.target.value)
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-stack">
                    <span>연결 링크 (선택)</span>
                    <input
                      value={selectedBlockMeta.block.data.link ?? ""}
                      onChange={(event) =>
                        updateNoticeField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "link", event.target.value)
                      }
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                  <label className="v3-row" style={{ alignItems: "center", gap: "0.45rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedBlockMeta.block.data.visible !== false}
                      onChange={(event) =>
                        updateNoticeField(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, "visible", event.target.checked)
                      }
                    />
                    <span>표시</span>
                  </label>
                  {renderStyleControls(
                    selectedBlockMeta.sectionId,
                    selectedBlockMeta.block.id,
                    selectedBlockMeta.block.data.style
                  )}
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "SPACER" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>간격 크기</span>
                    <input
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      type="number"
                      min={4}
                      max={120}
                      value={selectedBlockMeta.block.data.size}
                      onChange={(event) => updateSpacerSize(selectedBlockMeta.sectionId, selectedBlockMeta.block.id, event.target.value)}
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>
                </div>
              ) : null}
              {selectedBlockMeta.block.type === "DIVIDER" ? (
                <div className="v3-stack">
                  <label className="v3-stack">
                    <span>선 모양</span>
                    <select
                      id={`block-primary-input-${selectedBlockMeta.block.id}`}
                      value={selectedBlockMeta.block.data.lineStyle}
                      onChange={() => {
                        /* lineStyle is fixed for now */
                      }}
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    >
                      <option value="SOLID">실선</option>
                    </select>
                  </label>
                  {renderStyleControls(
                    selectedBlockMeta.sectionId,
                    selectedBlockMeta.block.id,
                    selectedBlockMeta.block.data.style
                  )}
                </div>
              ) : null}
            </div>
          )}
        </aside>
        <div
          className="v3-stack platform-page-builder-structure"
          style={{ minWidth: 0 }}
          onWheelCapture={(event) => event.stopPropagation()}
        >
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">섹션 목록</h2>
        <p className="v3-muted">현재 섹션 수: {sectionCountLabel}</p>
        <div className="v3-row">
          <button type="button" className="v3-btn" onClick={handleAddSection}>
            섹션 추가
          </button>
          <select
            value={selectedSectionPreset}
            onChange={(event) => setSelectedSectionPreset(event.target.value as SectionPresetType)}
            style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            {SECTION_PRESET_OPTIONS.map((option) => (
              <option key={`section-preset-${option.type}`} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="v3-btn"
            onClick={() => handleInsertPresetSectionAt(sections.length, selectedSectionPreset)}
          >
            프리셋 삽입
          </button>
        </div>
        {renderQuickPresetInsertButtons(sections.length)}
      </section>
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">섹션 개요</h2>
        <label className="v3-stack">
          <span>타입 찾기</span>
          <select
            value={sectionTypeFilter}
            onChange={(event) => setSectionTypeFilter(event.target.value as SectionTypeFilter)}
            style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          >
            <option value="ALL">전체</option>
            <option value="TITLE">제목</option>
            <option value="BUTTON">버튼</option>
            <option value="LINK">링크</option>
            <option value="SLIDE_CARDS">슬라이드 카드</option>
            <option value="NOTICE">공지</option>
            <option value="SPACER">여백</option>
            <option value="DIVIDER">구분선</option>
          </select>
        </label>
        {sections.length === 0 ? (
          <p className="v3-muted">아직 섹션이 없습니다.</p>
        ) : (
          <div className="v3-stack">
            {sections.map((section) => {
              const matchesType =
                sectionTypeFilter === "ALL" ? true : sectionHasBlockType(section, sectionTypeFilter);
              return (
                <button
                  key={`section-overview-${section.id}`}
                  type="button"
                  className="v3-btn"
                  onClick={() => {
                    openOnlySection(section.id);
                    scrollToSection(section.id);
                    setSelectedSectionId(section.id);
                    setSelectedBlockId(null);
                  }}
                  style={matchesType ? { fontWeight: 700 } : undefined}
                >
                  {getSectionDisplayName(section)} (블록 {section.blocks.length}개)
                </button>
              );
            })}
          </div>
        )}
      </section>

      {sections.length === 0 ? (
        <section className="v3-box v3-stack">
          <p className="v3-muted">섹션이 없습니다. 먼저 섹션을 추가해 주세요.</p>
          <div className="v3-row">
            <button type="button" className="v3-btn" onClick={() => handleInsertSectionAt(0)}>
              섹션 추가
            </button>
            <button
              type="button"
              className="v3-btn"
              onClick={() => handleInsertPresetSectionAt(0, selectedSectionPreset)}
            >
              프리셋 삽입
            </button>
          </div>
          {renderQuickPresetInsertButtons(0)}
        </section>
      ) : (
        <div className="v3-stack">
          {sections.map((section, index) => {
            const matchesType =
              sectionTypeFilter === "ALL" ? true : sectionHasBlockType(section, sectionTypeFilter);
            return (
            <div key={`${section.id}-section-wrap`} className="v3-stack">
              <div className="v3-row">
                <button type="button" className="v3-btn" onClick={() => handleInsertSectionAt(index)}>
                  섹션 추가
                </button>
                <button
                  type="button"
                  className="v3-btn"
                  onClick={() => handleInsertPresetSectionAt(index, selectedSectionPreset)}
                >
                  프리셋 삽입
                </button>
              </div>
              {renderQuickPresetInsertButtons(index)}
              <section
                id={`section-card-${section.id}`}
                className="v3-box v3-stack"
                onClick={() => setSelectedSectionId(section.id)}
                style={
                  selectedSectionId === section.id
                    ? { boxShadow: "0 0 0 2px #3b82f6 inset", background: "#f8fbff" }
                    : sectionTypeFilter !== "ALL" && matchesType
                      ? { boxShadow: "0 0 0 2px #d1d5db inset" }
                      : undefined
                }
              >
              <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="v3-stack" style={{ gap: "0.2rem" }}>
                  <h3 className="v3-h2" style={{ marginBottom: 0 }}>
                    {getSectionDisplayName(section)}
                  </h3>
                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                    섹션 순서: {section.order} / 블록 수: {section.blocks.length} / {getSectionBlockTypeSummary(section)}
                  </p>
                </div>
                <div className="v3-row">
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={() => toggleSectionExpanded(section.id)}
                  >
                    {isSectionExpanded(section.id) ? "섹션 접기" : "섹션 펼치기"}
                  </button>
                  <button type="button" className="v3-btn" onClick={() => handleDuplicateSection(section.id)}>
                    복제
                  </button>
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={() => moveSection(section.id, "up")}
                    disabled={index === 0}
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    className="v3-btn"
                    onClick={() => moveSection(section.id, "down")}
                    disabled={index === sections.length - 1}
                  >
                    아래로
                  </button>
                  <button type="button" className="v3-btn" onClick={() => handleDeleteSection(section.id)}>
                    섹션 삭제
                  </button>
                </div>
              </div>
              {isSectionExpanded(section.id) ? (
                <>
                  <label className="v3-stack">
                    <span>섹션 이름</span>
                    <input
                      id={`section-name-${section.id}`}
                      value={section.name}
                      onChange={(event) => updateSectionName(section.id, event.target.value)}
                      placeholder={`예: ${`섹션 ${section.order}`}`}
                      style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
                    />
                  </label>

                  <section className="v3-box v3-stack" style={{ background: "#fff" }}>
                    <h4 className="v3-h2" style={{ marginBottom: 0 }}>
                      블록 추가
                    </h4>
                    <div className="v3-stack">
                      <p className="v3-muted" style={{ margin: 0 }}>
                        콘텐츠 블록
                      </p>
                      <div className="v3-row">
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "TITLE")}>
                          제목 블록 추가
                        </button>
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "BUTTON")}>
                          버튼 블록 추가
                        </button>
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "LINK")}>
                          링크 블록 추가
                        </button>
                        <button
                          type="button"
                          className="v3-btn"
                          onClick={() => handleAddBlock(section.id, "SLIDE_CARDS")}
                        >
                          슬라이드 블록 추가
                        </button>
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "NOTICE")}>
                          공지 블록 추가
                        </button>
                      </div>
                    </div>
                    <div className="v3-stack">
                      <p className="v3-muted" style={{ margin: 0 }}>
                        레이아웃 블록
                      </p>
                      <div className="v3-row">
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "SPACER")}>
                          SPACER 블록 추가
                        </button>
                        <button type="button" className="v3-btn" onClick={() => handleAddBlock(section.id, "DIVIDER")}>
                          DIVIDER 블록 추가
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="v3-box v3-stack" style={{ background: "#fafafa" }}>
                    <h4 className="v3-h2" style={{ marginBottom: 0 }}>
                      섹션 내부 블록
                    </h4>
                    {section.blocks.length > 0 ? (
                      <div className="v3-row">
                        <button
                          type="button"
                          className="v3-btn"
                          onClick={() => setSectionBlocksExpanded(section, true)}
                        >
                          모두 펼치기
                        </button>
                        <button
                          type="button"
                          className="v3-btn"
                          onClick={() => setSectionBlocksExpanded(section, false)}
                        >
                          모두 접기
                        </button>
                      </div>
                    ) : null}
                    {section.blocks.length === 0 ? (
                      <div className="v3-stack">
                        <p className="v3-muted">아직 블록이 없습니다.</p>
                        <div className="v3-stack">
                          <div className="v3-row">
                            <button
                              type="button"
                              className="v3-btn"
                              onClick={() =>
                                setInsertSelector((prev) =>
                                  prev && prev.sectionId === section.id && prev.insertIndex === 0
                                    ? null
                                    : { sectionId: section.id, insertIndex: 0 }
                                )
                              }
                            >
                              [+]
                            </button>
                          </div>
                          {insertSelector?.sectionId === section.id && insertSelector.insertIndex === 0 ? (
                            <div className="v3-row">
                              {INSERT_BLOCK_TYPE_OPTIONS.map((option) => (
                                <button
                                  key={`${section.id}-insert-0-${option.type}`}
                                  type="button"
                                  className="v3-btn"
                                  onClick={() => handleInsertBlockAt(section.id, 0, option.type)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="v3-stack">
                        {section.blocks.map((block, blockIndex) => (
                          <div key={block.id} className="v3-stack">
                            <div className="v3-stack">
                              <div className="v3-row">
                                <button
                                  type="button"
                                  className="v3-btn"
                                  onClick={() =>
                                    setInsertSelector((prev) =>
                                      prev && prev.sectionId === section.id && prev.insertIndex === blockIndex
                                        ? null
                                        : { sectionId: section.id, insertIndex: blockIndex }
                                    )
                                  }
                                >
                                  [+]
                                </button>
                              </div>
                              {insertSelector?.sectionId === section.id &&
                              insertSelector.insertIndex === blockIndex ? (
                                <div className="v3-row">
                                  {INSERT_BLOCK_TYPE_OPTIONS.map((option) => (
                                    <button
                                      key={`${section.id}-insert-${blockIndex}-${option.type}`}
                                      type="button"
                                      className="v3-btn"
                                      onClick={() => handleInsertBlockAt(section.id, blockIndex, option.type)}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <article
                              id={`block-card-${block.id}`}
                              className="v3-box v3-stack"
                              onClick={() => {
                                setSelectedBlockId(block.id);
                                setSelectedSectionId(section.id);
                                openOnlySection(section.id);
                              }}
                              style={
                                selectedBlockId === block.id
                                  ? { boxShadow: "0 0 0 2px #3b82f6 inset", background: "#eff6ff" }
                                  : undefined
                              }
                            >
                              <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                <div className="v3-stack" style={{ gap: "0.2rem" }}>
                                  <p style={{ margin: 0, fontWeight: 700 }}>{getBlockTypeLabel(block)}</p>
                                  <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                                    {getBlockSummary(block)}
                                  </p>
                                </div>
                                <div className="v3-row">
                                  <button
                                    type="button"
                                    className="v3-btn"
                                    onClick={() => toggleBlockExpanded(block.id)}
                                  >
                                    {isBlockExpanded(block.id) ? "접기" : "펼치기"}
                                  </button>
                                  <button
                                    type="button"
                                    className="v3-btn"
                                    onClick={() => handleDuplicateBlock(section.id, block.id)}
                                  >
                                    복제
                                  </button>
                                  <button
                                    type="button"
                                    className="v3-btn"
                                    onClick={() => moveBlock(section.id, block.id, "up")}
                                    disabled={blockIndex === 0}
                                  >
                                    위로
                                  </button>
                                  <button
                                    type="button"
                                    className="v3-btn"
                                    onClick={() => moveBlock(section.id, block.id, "down")}
                                    disabled={blockIndex === section.blocks.length - 1}
                                  >
                                    아래로
                                  </button>
                                  <button
                                    type="button"
                                    className="v3-btn"
                                    onClick={() => handleDeleteBlock(section.id, block.id)}
                                  >
                                    블록 삭제
                                  </button>
                                </div>
                              </div>

                            </article>
                          </div>
                        ))}
                        <div className="v3-row">
                          <div className="v3-stack">
                            <div className="v3-row">
                              <button
                                type="button"
                                className="v3-btn"
                                onClick={() =>
                                  setInsertSelector((prev) =>
                                    prev &&
                                    prev.sectionId === section.id &&
                                    prev.insertIndex === section.blocks.length
                                      ? null
                                      : { sectionId: section.id, insertIndex: section.blocks.length }
                                  )
                                }
                              >
                                [+]
                              </button>
                            </div>
                            {insertSelector?.sectionId === section.id &&
                            insertSelector.insertIndex === section.blocks.length ? (
                              <div className="v3-row">
                                {INSERT_BLOCK_TYPE_OPTIONS.map((option) => (
                                  <button
                                    key={`${section.id}-insert-${section.blocks.length}-${option.type}`}
                                    type="button"
                                    className="v3-btn"
                                    onClick={() =>
                                      handleInsertBlockAt(section.id, section.blocks.length, option.type)
                                    }
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              ) : null}
              </section>
            </div>
            );
          })}
          <div className="v3-row">
            <button type="button" className="v3-btn" onClick={() => handleInsertSectionAt(sections.length)}>
              섹션 추가
            </button>
            <button
              type="button"
              className="v3-btn"
              onClick={() => handleInsertPresetSectionAt(sections.length, selectedSectionPreset)}
            >
              프리셋 삽입
            </button>
          </div>
          {renderQuickPresetInsertButtons(sections.length)}
        </div>
      )}

      <Link className="v3-btn" href="/platform/site" onClick={confirmLeaveWhenUnsaved}>
        사이트 관리로
      </Link>
        </div>
        <div className="platform-page-builder-preview-panel" onWheelCapture={(event) => event.stopPropagation()}>
          <MobilePreview
            draftId={builderPageId}
            refreshToken={previewRefreshToken}
            selectedSectionId={selectedSectionId}
            selectedBlockId={selectedBlockId}
            onPreviewSelect={handlePreviewSelect}
          />
        </div>
      </div>
      </PageBuilderCanvasShell>
      <style jsx>{`
        .platform-page-builder-root--mobile-canvas {
          min-height: 0;
        }

        .platform-page-builder-workspace--in-canvas {
          height: auto !important;
          min-height: 480px;
          overflow: visible !important;
        }

        .platform-page-builder-topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 40;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.55rem 0.5rem;
        }

        .platform-page-builder-topbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          min-height: 3.2rem;
        }

        .platform-page-builder-topbar-summary {
          margin: 0;
          padding-left: 1rem;
          display: grid;
          gap: 0.1rem;
          color: #4b5563;
          font-size: 0.9rem;
          line-height: 1.25;
        }

        .platform-page-builder-workspace {
          display: grid;
          grid-template-columns: minmax(240px, 25%) minmax(300px, 50%) minmax(280px, 25%);
          gap: 1rem;
          align-items: stretch;
          width: 100%;
          height: calc(100vh - 8.2rem);
          min-height: 0;
          overflow: hidden;
        }

        .platform-page-builder-settings {
          position: relative;
          align-self: stretch;
          grid-column: 1;
          min-width: 240px;
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .platform-page-builder-structure {
          grid-column: 2;
          min-width: 300px;
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .platform-page-builder-workspace > :nth-child(3) {
          min-width: 280px;
        }

        .platform-page-builder-preview-panel {
          grid-column: 3;
          height: 100%;
          overflow: hidden;
          overscroll-behavior: contain;
        }
      `}</style>
    </main>
  );
}

export default function PlatformSitePagesPage() {
  return (
    <Suspense
      fallback={
        <main
          className="v3-page v3-stack"
          style={{ width: "100%", maxWidth: "none", margin: 0, paddingLeft: "1.25rem", paddingRight: "1.25rem" }}
        >
          <p className="v3-muted">불러오는 중...</p>
        </main>
      }
    >
      <PlatformSitePagesPageContent />
    </Suspense>
  );
}
