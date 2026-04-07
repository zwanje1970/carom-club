"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageBuilderMobilePreview } from "@/components/admin/page-builder/PageBuilderMobilePreview";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { BasicCard, HighlightCard } from "@/components/cards/TournamentPublishedCard";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import { DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES } from "@/lib/platform-card-templates";

type BuilderPage = "home" | "community" | "tournaments";
type SectionType = "text" | "image" | "cta";
type TextAlign = "left" | "center" | "right";
type StepKey = "step1" | "step2" | "step3" | "step4";
type StepState = "open" | "done" | "locked";
type CardKind = "default" | "custom" | "publishedTournament" | "publishedVenue";
type SpacingPreset = "compact" | "normal" | "wide";
type ElementType = "text" | "card" | "cta";
type ElementCtaPlacement =
  | "headerRight"
  | "blockBottomLeft"
  | "blockBottomCenter"
  | "blockBottomRight"
  | "outsideBottomLeft"
  | "outsideBottomCenter"
  | "outsideBottomRight";

type BuilderElement = {
  id: string;
  type: ElementType;
  textTitle?: string;
  textBody?: string;
  cardKind?: CardKind;
  ctaLabel?: string;
  ctaHref?: string;
  ctaPlacement?: ElementCtaPlacement;
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

function normalizeElementCtaPlacement(raw: unknown): ElementCtaPlacement {
  return raw === "blockBottomLeft" ||
    raw === "blockBottomCenter" ||
    raw === "blockBottomRight" ||
    raw === "outsideBottomLeft" ||
    raw === "outsideBottomCenter" ||
    raw === "outsideBottomRight"
    ? (raw as ElementCtaPlacement)
    : "headerRight";
}

function emptyBuilderElement(type: ElementType): BuilderElement {
  if (type === "text") return { id: makeId("el"), type, textTitle: "제목", textBody: "설명" };
  if (type === "card") return { id: makeId("el"), type, cardKind: "default" };
  return {
    id: makeId("el"),
    type,
    ctaLabel: "전체보기",
    ctaHref: "/tournaments",
    ctaPlacement: "blockBottomRight",
  };
}

function toBuilderElement(raw: unknown): BuilderElement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== "text" && o.type !== "card" && o.type !== "cta") return null;
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id : makeId("el"),
    type: o.type as ElementType,
    textTitle: typeof o.textTitle === "string" ? o.textTitle : "",
    textBody: typeof o.textBody === "string" ? o.textBody : "",
    cardKind: resolveCardKind(o.cardKind),
    ctaLabel: typeof o.ctaLabel === "string" ? o.ctaLabel : "전체보기",
    ctaHref: typeof o.ctaHref === "string" ? o.ctaHref : "/tournaments",
    ctaPlacement: normalizeElementCtaPlacement(o.ctaPlacement),
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
    textTitle: draft?.title ?? "",
    textBody: draft?.description ?? "",
  });
  if (Array.isArray(style.contentExtras)) {
    for (const item of style.contentExtras as unknown[]) {
      const text = String(item ?? "").trim();
      if (!text) continue;
      fallback.push({ id: makeId("el"), type: "text", textTitle: "", textBody: text });
    }
  }
  if (Boolean(style.cardEnabled)) {
    fallback.push({ id: makeId("el"), type: "card", cardKind: resolveCardKind(style.cardKind) });
  }
  if (String(style.contentMode ?? "cms") === "cta" && String(style.contentCtaLink ?? "").trim()) {
    fallback.push({
      id: makeId("el"),
      type: "cta",
      ctaLabel: "전체보기",
      ctaHref: String(style.contentCtaLink ?? ""),
      ctaPlacement: normalizeElementCtaPlacement(style.contentCtaPlacement),
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [createType, setCreateType] = useState<SectionType>("text");
  const [step1EditMode, setStep1EditMode] = useState(false);

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
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startScrollTop: number;
    dragging: boolean;
    viewport: HTMLElement | null;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startScrollTop: 0,
    dragging: false,
    viewport: null,
  });
  const suppressSelectUntilRef = useRef(0);
  const DRAG_THRESHOLD_PX = 7;

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

  const style = useMemo(() => parseStyle(draft?.sectionStyleJson), [draft?.sectionStyleJson]);
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

  const previewRows = useMemo(() => {
    if (!selectedId || !draft) return rows;
    return rows.map((r) => (r.id === selectedId ? draft : r));
  }, [rows, selectedId, draft]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return rows.findIndex((r) => r.id === selectedId);
  }, [rows, selectedId]);

  const selected = useMemo(() => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null), [rows, selectedId]);

  const loadRows = async (targetPage: BuilderPage) => {
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
      setSelectedId(nextRows[0].id);
      setDraft({ ...nextRows[0], buttons: Array.isArray(nextRows[0].buttons) ? [...nextRows[0].buttons] : [] });
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

  const persist = async (next: PageSection): Promise<PageSection | null> => {
    setSaving(true);
    try {
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...body } = next;
      const res = await fetch("/api/admin/content/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const updateStyle = (patch: StyleMap) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextStyle = { ...parseStyle(prev.sectionStyleJson), ...patch };
      return { ...prev, sectionStyleJson: toStyleJson(nextStyle) };
    });
  };

  const updateDraft = (patch: Partial<PageSection>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateElements = (next: BuilderElement[]) => {
    const firstText = next.find((it) => it.type === "text");
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
        textTitle: it.textTitle ?? "",
        textBody: it.textBody ?? "",
        cardKind: it.cardKind ?? "default",
        ctaLabel: it.ctaLabel ?? "전체보기",
        ctaHref: it.ctaHref ?? "",
        ctaPlacement: it.ctaPlacement ?? "headerRight",
      })),
      contentExtras: extraTexts,
      cardEnabled: Boolean(firstCard),
      cardKind: firstCard?.cardKind ?? style.cardKind ?? "default",
      contentMode: firstCta && String(firstCta.ctaHref ?? "").trim() ? "cta" : "cms",
      contentCtaLink: firstCta?.ctaHref ?? "",
      contentCtaPlacement: firstCta?.ctaPlacement ?? "headerRight",
    });
    if (firstText) {
      updateDraft({
        title: String(firstText.textTitle ?? ""),
        description: String(firstText.textBody ?? ""),
      });
    }
  };


  const openStep = (step: StepKey) => {
    if (step === "step1") setStep1EditMode(true);
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
    const stylePatch: StyleMap = {
      blockLayout: s1Layout,
      blockMode: s1Mode,
      blockCtaLink: s1CtaLink.trim(),
      blockShape: s1Shape,
      blockWidth: s1Width,
      blockHeight: s1Height,
      blockRadius: s1Radius,
      blockBorderEnabled: s1BorderEnabled,
      blockBorderColor: s1BorderColor,
      blockBgImageInputMode: s1BgImageMode,
      blockBgImage: s1BgImage.trim(),
    };

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
      await loadRows(page);
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

  const onPreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const frame = previewFrameRef.current;
    if (!frame) return;
    const viewport = frame.querySelector('[id^="preview-viewport-"]') as HTMLElement | null;
    if (!viewport) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
      dragging: false,
      viewport,
    };
  };

  const onPreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId || !state.viewport) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.dragging && Math.max(Math.abs(dx), Math.abs(dy)) >= DRAG_THRESHOLD_PX) {
      state.dragging = true;
      if (previewFrameRef.current && !previewFrameRef.current.hasPointerCapture(event.pointerId)) {
        previewFrameRef.current.setPointerCapture(event.pointerId);
      }
    }
    if (!state.dragging) return;
    state.viewport.scrollTop = state.startScrollTop - dy;
    event.preventDefault();
  };

  const endPreviewPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== event.pointerId) return;
    if (state.dragging) {
      suppressSelectUntilRef.current = Date.now() + 180;
    }
    dragStateRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startScrollTop: 0,
      dragging: false,
      viewport: null,
    };
    if (previewFrameRef.current?.hasPointerCapture(event.pointerId)) {
      previewFrameRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const onPreviewSelectBlock = (id: string) => {
    if (Date.now() < suppressSelectUntilRef.current) return;
    selectRow(id);
  };

  const previewPanel = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 rounded-xl border border-site-border bg-white p-2 dark:bg-slate-900">
        <div
          ref={previewFrameRef}
          className="mx-auto w-full max-w-[360px] select-none cursor-grab active:cursor-grabbing"
          onPointerDown={onPreviewPointerDown}
          onPointerMove={onPreviewPointerMove}
          onPointerUp={endPreviewPointer}
          onPointerCancel={endPreviewPointer}
        >
          <PageBuilderMobilePreview
            page={page as PageBuilderKey}
            rows={previewRows as unknown as import("@/types/page-section").PageSection[]}
            variant="mobile"
            selectedBlockId={selectedId}
            autoScrollOnSelect={false}
            showTitle={false}
            onSelectBlock={onPreviewSelectBlock}
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
        <div className="mx-auto h-full w-full max-w-[460px] overflow-y-auto">
          {draft ? (
            <>
            <div
              className="rounded-xl border border-site-border bg-white p-2 dark:bg-slate-900"
              style={{
                backgroundColor: String(draft.backgroundColor ?? "#ffffff"),
                borderStyle: Boolean(style.blockBorderEnabled) ? "solid" : "none",
                borderColor: String(style.blockBorderColor ?? "#d1d5db"),
                borderWidth: Boolean(style.blockBorderEnabled) ? 1 : 0,
                borderRadius:
                  String(style.blockShape ?? "square") === "circle"
                    ? "9999px"
                    : `${Number(style.blockRadius ?? 12)}px`,
                width: Number(style.blockWidth ?? 0) > 0 ? `${Math.min(Number(style.blockWidth), 440)}px` : "100%",
                maxWidth: "100%",
                minHeight: Number(style.blockHeight ?? 0) > 0 ? `${Math.min(Number(style.blockHeight), 420)}px` : undefined,
                backgroundImage: String(style.blockBgImage ?? "") ? `url(${String(style.blockBgImage)})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {String(style.titlePosition ?? "top") === "top" ? (
                <p
                  style={{
                    textAlign: String(style.titleAlign ?? draft.textAlign) as "left" | "center" | "right",
                    fontSize: `${Number(style.titleSize ?? 18)}px`,
                    fontWeight: Number(style.titleWeight ?? "700"),
                    color: String(style.titleColor ?? "#111827"),
                  }}
                >
                  {draft.title || "제목"}
                </p>
              ) : null}
              {(() => {
                const contentMode = String(style.contentMode ?? "cms");
                const contentCtaLink = String(style.contentCtaLink ?? "").trim();
                const contentCtaPlacement = String(style.contentCtaPlacement ?? "headerRight");
                const hasContentCta = contentMode === "cta" && contentCtaLink.length > 0;
                if (!hasContentCta || contentCtaPlacement !== "headerRight") return null;
                return (
                  <div className="mt-2 flex justify-end">
                    <span className="inline-flex rounded border border-site-primary/40 bg-site-primary/10 px-2.5 py-1 text-xs font-medium text-site-primary">
                      CTA
                    </span>
                  </div>
                );
              })()}

              <p
                className={String(style.titlePosition ?? "top") === "middle" ? "mt-3" : "mt-2"}
                style={{
                  textAlign: String(style.contentAlign ?? draft.textAlign) as "left" | "center" | "right",
                  fontSize: `${Number(style.contentSize ?? 14)}px`,
                  fontWeight: Number(style.contentWeight ?? "400"),
                  color: String(style.contentColor ?? "#374151"),
                  marginTop: `${elementSpacingPx}px`,
                }}
              >
                {draft.description || ""}
              </p>

              {Array.isArray(style.contentExtras)
                ? (style.contentExtras as unknown[]).map((item, idx) => (
                    <p
                      key={`preview-extra-${idx}`}
                      className="mt-1"
                      style={{
                        textAlign: String(style.contentAlign ?? draft.textAlign) as "left" | "center" | "right",
                        fontSize: `${Number(style.contentSize ?? 14)}px`,
                        fontWeight: Number(style.contentWeight ?? "400"),
                        color: String(style.contentColor ?? "#374151"),
                        marginTop: `${Math.max(2, Math.round(elementSpacingPx * 0.7))}px`,
                      }}
                    >
                      {String(item ?? "")}
                    </p>
                  ))
                : null}

              {String(style.titlePosition ?? "top") === "middle" || String(style.titlePosition ?? "top") === "bottom" ? (
                <p
                  className={String(style.titlePosition ?? "top") === "bottom" ? "mt-3" : "mt-2"}
                  style={{
                    textAlign: String(style.titleAlign ?? draft.textAlign) as "left" | "center" | "right",
                    fontSize: `${Number(style.titleSize ?? 18)}px`,
                    fontWeight: Number(style.titleWeight ?? "700"),
                    color: String(style.titleColor ?? "#111827"),
                  }}
                >
                  {draft.title || "제목"}
                </p>
              ) : null}

              {Boolean(style.cardEnabled) ? (
                <div
                  className="mt-3 overflow-hidden"
                  style={{
                    backgroundColor: String(style.cardColor ?? "#ffffff"),
                    borderStyle: Boolean(style.cardBorderEnabled) ? "solid" : "none",
                    borderColor: String(style.cardBorderColor ?? "#d1d5db"),
                    borderWidth: Boolean(style.cardBorderEnabled) ? 1 : 0,
                    borderRadius:
                      String(style.cardShape ?? "square") === "circle"
                        ? "9999px"
                        : `${Number(style.cardRadius ?? 12)}px`,
                    marginTop: `${cardSpacingPx}px`,
                  }}
                >
                  {(() => {
                    const cardKind = resolveCardKind(style.cardKind);
                    const isDefaultCard = cardKind === "default";
                    const isPublishedCard = isPublishedCardKind(cardKind);
                    const publishedLabel =
                      cardKind === "publishedVenue" ? "당구장 메인 게시용카드" : "대회 메인 게시용카드";
                    const titleFromField =
                      String(style.defaultTitleSource ?? "direct") === "field"
                        ? String((draft as unknown as Record<string, unknown>)[String(style.cardTitleField ?? "title")] ?? "")
                        : "";
                    const bodyFromField =
                      String(style.defaultBodySource ?? "direct") === "field"
                        ? String((draft as unknown as Record<string, unknown>)[String(style.cardBodyField ?? "description")] ?? "")
                        : "";
                    const imageFromField =
                      String(style.defaultImageSource ?? "direct") === "field"
                        ? String((draft as unknown as Record<string, unknown>)[String(style.cardImageField ?? "imageUrl")] ?? "")
                        : "";
                    const resolvedTitle = isDefaultCard
                      ? (titleFromField || String(style.cardTitleText ?? "카드 제목"))
                      : String(style.cardTitleText ?? "카드 제목");
                    const resolvedBody = isDefaultCard
                      ? (bodyFromField || String(style.cardBodyText ?? "카드 내용"))
                      : String(style.cardBodyText ?? "카드 내용");
                    const resolvedImage = isDefaultCard
                      ? (imageFromField || String(style.cardBackgroundImage ?? draft.imageUrl ?? ""))
                      : String(style.cardBackgroundImage ?? draft.imageUrl ?? "");
                    const ctaLink =
                      cardKind === "custom"
                        ? String(style.cardCustomCtaLink ?? style.cardCtaLink ?? "")
                        : String(style.cardCtaLink ?? "");
                    if (isPublishedCard) {
                      const previewData = {
                        templateType: cardKind === "publishedVenue" ? "highlight" : "basic",
                        thumbnailUrl: resolvedImage || "",
                        cardTitle: resolvedTitle || (cardKind === "publishedVenue" ? "당구장 상호명" : "대회 제목"),
                        displayDateText: "2026-04-06",
                        displayRegionText: "서울",
                        statusText: "접수중",
                        buttonText: "자세히 보기",
                        shortDescription: resolvedBody || "",
                      } as const;
                      return (
                        <div className="space-y-2 p-3">
                          <p className="text-xs font-semibold text-site-text">{publishedLabel}</p>
                          <div className="flex justify-center">
                            {cardKind === "publishedVenue" ? (
                              <HighlightCard
                                data={previewData}
                                stylePolicy={DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES.highlight}
                                showDetailButton={false}
                              />
                            ) : (
                              <BasicCard
                                data={previewData}
                                stylePolicy={DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES.basic}
                                showDetailButton={false}
                              />
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <>
                        {resolvedImage ? (
                          <div
                            style={{
                              height: `${Math.min(Number(style.cardHeight ?? 180), 220)}px`,
                              backgroundImage: `url(${resolvedImage})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          />
                        ) : null}
                        <div className="space-y-1 p-2">
                          <p className="text-sm font-semibold text-site-text">{resolvedTitle}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">{resolvedBody}</p>
                          {Array.isArray(style.cardExtras)
                            ? (style.cardExtras as unknown[]).map((item, idx) => (
                                <p key={`preview-card-extra-${idx}`} className="text-xs text-gray-600 dark:text-slate-400">
                                  {String(item ?? "")}
                                </p>
                              ))
                            : null}
                          {String(style.cardMode ?? "cms") === "cta" && ctaLink ? (
                            <p className="text-xs font-medium text-site-primary">CTA: {ctaLink}</p>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
              {(() => {
                const contentMode = String(style.contentMode ?? "cms");
                const contentCtaLink = String(style.contentCtaLink ?? "").trim();
                const contentCtaPlacement = String(style.contentCtaPlacement ?? "headerRight");
                const hasContentCta = contentMode === "cta" && contentCtaLink.length > 0;
                if (!hasContentCta || !contentCtaPlacement.startsWith("blockBottom")) return null;
                const align =
                  contentCtaPlacement.endsWith("Right")
                    ? "justify-end"
                    : contentCtaPlacement.endsWith("Center")
                      ? "justify-center"
                      : "justify-start";
                return (
                  <div className={`flex ${align}`} style={{ marginTop: `${blockSpacingPx}px` }}>
                    <span className="inline-flex rounded border border-site-primary/40 bg-site-primary/10 px-2.5 py-1 text-xs font-medium text-site-primary">
                      CTA
                    </span>
                  </div>
                );
              })()}
            </div>
            {(() => {
              const contentMode = String(style.contentMode ?? "cms");
              const contentCtaLink = String(style.contentCtaLink ?? "").trim();
              const contentCtaPlacement = String(style.contentCtaPlacement ?? "headerRight");
              const hasContentCta = contentMode === "cta" && contentCtaLink.length > 0;
              if (!hasContentCta || !contentCtaPlacement.startsWith("outsideBottom")) return null;
              const align =
                contentCtaPlacement.endsWith("Right")
                  ? "justify-end"
                  : contentCtaPlacement.endsWith("Center")
                    ? "justify-center"
                    : "justify-start";
              return (
                <div className={`flex ${align}`} style={{ marginTop: `${blockSpacingPx}px` }}>
                  <span className="inline-flex rounded border border-site-primary/40 bg-site-primary/10 px-2.5 py-1 text-xs font-medium text-site-primary">
                    CTA
                  </span>
                </div>
              );
            })()}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-site-border p-4 text-sm text-gray-500 dark:text-slate-400">
              선택된 블록이 없습니다.
            </div>
          )}
        </div>
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
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">제목</p>
              <select value={String(style.titlePosition ?? "top")} onChange={(e) => updateStyle({ titlePosition: e.target.value })} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                <option value="top">제목 위치: 상단</option>
                <option value="middle">제목 위치: 중앙</option>
                <option value="bottom">제목 위치: 하단</option>
              </select>
              <input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="제목 입력" className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
              <div className="grid gap-2 sm:grid-cols-3">
                <input type="number" value={Number(style.titleSize ?? 18)} onChange={(e) => updateStyle({ titleSize: Number(e.target.value || 18) })} placeholder="폰트 크기" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                <select value={String(style.titleWeight ?? "700")} onChange={(e) => updateStyle({ titleWeight: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                  <option value="400">보통</option>
                  <option value="500">중간</option>
                  <option value="700">굵게</option>
                </select>
                <input type="color" value={String(style.titleColor ?? "#111827")} onChange={(e) => updateStyle({ titleColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
                <select value={String(style.titleAlign ?? draft.textAlign)} onChange={(e) => { updateStyle({ titleAlign: e.target.value }); updateDraft({ textAlign: e.target.value as TextAlign }); }} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                  <option value="left">왼쪽 정렬</option>
                  <option value="center">가운데 정렬</option>
                  <option value="right">오른쪽 정렬</option>
                </select>
              </div>
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">내용</p>
              <select value={String(style.contentAlign ?? draft.textAlign)} onChange={(e) => updateStyle({ contentAlign: e.target.value })} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                <option value="left">내용 위치: 왼쪽</option>
                <option value="center">내용 위치: 가운데</option>
                <option value="right">내용 위치: 오른쪽</option>
              </select>
              <div className="space-y-2 rounded border border-site-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">간격 설정</p>
                  <select
                    value={spacingMode}
                    onChange={(e) => updateStyle({ spacingMode: e.target.value })}
                    className="rounded border border-site-border bg-white px-2 py-1 text-xs dark:bg-slate-900"
                  >
                    <option value="preset">간편 설정</option>
                    <option value="custom">사용자 설정</option>
                  </select>
                </div>
                {spacingMode === "custom" ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="number"
                      value={Number(style.blockSpacingPx ?? blockSpacingPx)}
                      onChange={(e) => updateStyle({ blockSpacingPx: Number(e.target.value || 0) })}
                      placeholder="블록 간격(px)"
                      className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                    />
                    <input
                      type="number"
                      value={Number(style.elementSpacingPx ?? elementSpacingPx)}
                      onChange={(e) => updateStyle({ elementSpacingPx: Number(e.target.value || 0) })}
                      placeholder="요소 간격(px)"
                      className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                    />
                    <input
                      type="number"
                      value={Number(style.cardSpacingPx ?? cardSpacingPx)}
                      onChange={(e) => updateStyle({ cardSpacingPx: Number(e.target.value || 0) })}
                      placeholder="카드 간격(px)"
                      className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                    />
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">블록 간격</span>
                      <select
                        value={blockSpacingPreset}
                        onChange={(e) => updateStyle({ blockSpacingPreset: e.target.value })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="compact">좁게</option>
                        <option value="normal">보통</option>
                        <option value="wide">넓게</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">요소 간격</span>
                      <select
                        value={elementSpacingPreset}
                        onChange={(e) => updateStyle({ elementSpacingPreset: e.target.value })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="compact">좁게</option>
                        <option value="normal">보통</option>
                        <option value="wide">넓게</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">카드 간격</span>
                      <select
                        value={cardSpacingPreset}
                        onChange={(e) => updateStyle({ cardSpacingPreset: e.target.value })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="compact">좁게</option>
                        <option value="normal">보통</option>
                        <option value="wide">넓게</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={String(style.contentMode ?? "cms")} onChange={(e) => updateStyle({ contentMode: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                  <option value="cms">CMS</option>
                  <option value="cta">CTA</option>
                </select>
                {String(style.contentMode ?? "cms") === "cta" ? (
                  <input value={String(style.contentCtaLink ?? "")} onChange={(e) => updateStyle({ contentCtaLink: e.target.value })} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                ) : null}
              </div>
              {String(style.contentMode ?? "cms") === "cta" ? (
                <div className="space-y-1 rounded border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/30">
                  <p className="text-xs font-semibold text-sky-900 dark:text-sky-100">CTA 위치</p>
                  <select
                    value={String(style.contentCtaPlacement ?? "headerRight")}
                    onChange={(e) => updateStyle({ contentCtaPlacement: e.target.value })}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                  >
                    <option value="headerRight">상단 오른쪽</option>
                    <option value="blockBottomLeft">블록 하단 왼쪽</option>
                    <option value="blockBottomCenter">블록 하단 가운데</option>
                    <option value="blockBottomRight">블록 하단 오른쪽</option>
                    <option value="outsideBottomLeft">블록 바깥 아래 왼쪽</option>
                    <option value="outsideBottomCenter">블록 바깥 아래 가운데</option>
                    <option value="outsideBottomRight">블록 바깥 아래 오른쪽</option>
                  </select>
                </div>
              ) : null}
              <textarea value={draft.description ?? ""} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="내용 입력" className="min-h-24 w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
              <div className="grid gap-2 sm:grid-cols-3">
                <input type="number" value={Number(style.contentSize ?? 14)} onChange={(e) => updateStyle({ contentSize: Number(e.target.value || 14) })} placeholder="폰트 크기" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                <select value={String(style.contentWeight ?? "400")} onChange={(e) => updateStyle({ contentWeight: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                  <option value="400">보통</option>
                  <option value="500">중간</option>
                  <option value="700">굵게</option>
                </select>
                <input type="color" value={String(style.contentColor ?? "#374151")} onChange={(e) => updateStyle({ contentColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
              </div>
              <div className="space-y-2 rounded border border-site-border p-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">요소 추가</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => updateElements([...elements, emptyBuilderElement("text")])}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    텍스트
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElements([...elements, emptyBuilderElement("card")])}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    카드
                  </button>
                  <button
                    type="button"
                    onClick={() => updateElements([...elements, emptyBuilderElement("cta")])}
                    className="rounded border border-site-border px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    CTA
                  </button>
                </div>
                <div className="space-y-2">
                  {elements.map((el, idx) => (
                    <div key={el.id} className="space-y-2 rounded border border-site-border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-slate-400">
                          {idx + 1}. {el.type === "text" ? "텍스트 요소" : el.type === "card" ? "카드 요소" : "CTA 요소"}
                        </p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
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
                            onClick={() => {
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
                            onClick={() => updateElements(elements.filter((it) => it.id !== el.id))}
                            className="rounded border border-site-border px-2 py-1 text-[11px]"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      {el.type === "text" ? (
                        <div className="grid gap-2">
                          <input
                            value={String(el.textTitle ?? "")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) => (it.id === el.id ? { ...it, textTitle: e.target.value } : it))
                              )
                            }
                            placeholder="텍스트 제목"
                            className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          />
                          <textarea
                            value={String(el.textBody ?? "")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) => (it.id === el.id ? { ...it, textBody: e.target.value } : it))
                              )
                            }
                            placeholder="텍스트 설명"
                            className="min-h-20 rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          />
                        </div>
                      ) : null}
                      {el.type === "card" ? (
                        <select
                          value={el.cardKind ?? "default"}
                          onChange={(e) =>
                            updateElements(
                              elements.map((it) =>
                                it.id === el.id ? { ...it, cardKind: resolveCardKind(e.target.value) } : it
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
                      ) : null}
                      {el.type === "cta" ? (
                        <div className="grid gap-2">
                          <input
                            value={String(el.ctaLabel ?? "전체보기")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) => (it.id === el.id ? { ...it, ctaLabel: e.target.value } : it))
                              )
                            }
                            placeholder="CTA 버튼명"
                            className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          />
                          <input
                            value={String(el.ctaHref ?? "")}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) => (it.id === el.id ? { ...it, ctaHref: e.target.value } : it))
                              )
                            }
                            placeholder="CTA 링크"
                            className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          />
                          <select
                            value={el.ctaPlacement ?? "headerRight"}
                            onChange={(e) =>
                              updateElements(
                                elements.map((it) =>
                                  it.id === el.id
                                    ? { ...it, ctaPlacement: normalizeElementCtaPlacement(e.target.value) }
                                    : it
                                )
                              )
                            }
                            className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                          >
                            <option value="headerRight">상단 오른쪽</option>
                            <option value="blockBottomLeft">블록 하단 왼쪽</option>
                            <option value="blockBottomCenter">블록 하단 가운데</option>
                            <option value="blockBottomRight">블록 하단 오른쪽</option>
                            <option value="outsideBottomLeft">블록 바깥 아래 왼쪽</option>
                            <option value="outsideBottomCenter">블록 바깥 아래 가운데</option>
                            <option value="outsideBottomRight">블록 바깥 아래 오른쪽</option>
                          </select>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded border border-site-border p-3 sm:col-span-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">슬라이드 설정</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(style.slideEnabled)}
                    onChange={(e) => updateStyle({ slideEnabled: e.target.checked })}
                  />
                  슬라이드 사용
                </label>
                {Boolean(style.slideEnabled) ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">자동 재생</span>
                      <select
                        value={String(style.slideAutoPlay ?? "true")}
                        onChange={(e) => updateStyle({ slideAutoPlay: e.target.value === "true" })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="true">켜기</option>
                        <option value="false">끄기</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">속도</span>
                      <select
                        value={String(style.slideSpeed ?? "normal")}
                        onChange={(e) => updateStyle({ slideSpeed: e.target.value })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="slow">느리게</option>
                        <option value="normal">보통</option>
                        <option value="fast">빠르게</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-gray-600 dark:text-slate-400">호버 시 동작</span>
                      <select
                        value={String(style.slidePauseOnHover ?? "true")}
                        onChange={(e) => updateStyle({ slidePauseOnHover: e.target.value === "true" })}
                        className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                      >
                        <option value="true">멈춤</option>
                        <option value="false">계속 이동</option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">슬라이드가 꺼져 있으면 일반 카드 목록으로 표시됩니다.</p>
                )}
              </div>
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
          {previewPanel}
          {blockSettingsPanel}
          {cardSettingsPanel}
        </div>
      ) : (
        <>
          {editorHeader}
          <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 gap-2 xl:grid-cols-[1.2fr_1fr_1fr]">
            <div className="min-h-0 overflow-y-auto pr-1">{previewPanel}</div>
            {blockSettingsPanel}
            {cardSettingsPanel}
          </div>
        </>
      )}
    </div>
  );
}
