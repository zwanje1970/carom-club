"use client";

import { useEffect, useMemo, useState } from "react";

type BuilderPage = "home" | "community" | "tournaments";
type SectionType = "text" | "image" | "cta";
type TextAlign = "left" | "center" | "right";
type StepKey = "step1" | "step2" | "step3" | "step4";
type StepState = "open" | "done" | "locked";
type CtaMode = "cms" | "cta";
type CardKind = "default" | "custom";

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
  titleIconType?: "none" | "icon" | "image" | null;
  titleIconName?: string | null;
  titleIconImageUrl?: string | null;
  titleIconSize?: "small" | "medium" | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

type StyleMap = Record<string, unknown>;

const PAGE_OPTIONS: Array<{ value: BuilderPage; label: string }> = [
  { value: "home", label: "메인페이지" },
  { value: "community", label: "커뮤니티" },
  { value: "tournaments", label: "대회 페이지" },
];

const STEP_ORDER: StepKey[] = ["step1", "step2", "step3", "step4"];

const INITIAL_STEPS: Record<StepKey, StepState> = {
  step1: "open",
  step2: "locked",
  step3: "locked",
  step4: "locked",
};

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

function emptyButton(sectionId: string): SectionButton {
  return {
    id: `btn-${sectionId}`,
    name: "",
    linkType: "external",
    href: "",
    openInNewTab: false,
    isPrimary: true,
  };
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
    titleIconType: "none",
    titleIconName: null,
    titleIconImageUrl: null,
    titleIconSize: null,
    deletedAt: null,
  };
}

function getStepSummary(step: StepKey, draft: PageSection | null): string {
  if (!draft) return "선택된 블록 없음";
  const style = parseStyle(draft.sectionStyleJson);
  if (step === "step1") {
    return `${String(style.blockLayout ?? "boxed") === "full" ? "전체형" : "박스형"} / ${String(style.blockMode ?? "cms").toUpperCase()}`;
  }
  if (step === "step2") {
    return `제목 ${draft.title?.trim() ? "입력됨" : "없음"} / 내용 ${draft.description?.trim() ? "입력됨" : "없음"}`;
  }
  if (step === "step3") {
    return Boolean(style.cardEnabled) ? "카드 사용" : "카드 사용 안 함";
  }
  return "카드 내용 설정 완료";
}

export default function AdminSitePageBuilderV2Page() {
  const [page, setPage] = useState<BuilderPage>("home");
  const [sections, setSections] = useState<PageSection[]>([]);
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

  const [step1Layout, setStep1Layout] = useState<"full" | "boxed">("boxed");
  const [step1Mode, setStep1Mode] = useState<CtaMode>("cms");
  const [step1CtaLink, setStep1CtaLink] = useState("");
  const [step1Shape, setStep1Shape] = useState<"circle" | "square">("square");
  const [step1Width, setStep1Width] = useState(0);
  const [step1Height, setStep1Height] = useState(0);
  const [step1Radius, setStep1Radius] = useState(12);
  const [step1BorderEnabled, setStep1BorderEnabled] = useState(false);
  const [step1BgColor, setStep1BgColor] = useState("#ffffff");
  const [step1BorderColor, setStep1BorderColor] = useState("#d1d5db");
  const [step1BgImage, setStep1BgImage] = useState("");
  const [step1IsEditMode, setStep1IsEditMode] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const style = useMemo(() => parseStyle(draft?.sectionStyleJson), [draft?.sectionStyleJson]);

  const previewSections = useMemo(() => {
    if (!selectedId || !draft) return sections;
    return sections.map((s) => (s.id === selectedId ? draft : s));
  }, [sections, selectedId, draft]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return sections.findIndex((s) => s.id === selectedId);
  }, [sections, selectedId]);

  const loadSections = async (targetPage: BuilderPage) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/content/page-layout?page=${encodeURIComponent(targetPage)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setError(typeof data?.error === "string" ? data.error : "목록을 불러오지 못했습니다.");
        setSections([]);
        setSelectedId(null);
        setDraft(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      const rows = data as PageSection[];
      setSections(rows);
      if (rows.length === 0) {
        setSelectedId(null);
        setDraft(null);
        setSteps(INITIAL_STEPS);
        return;
      }
      const first = rows[0];
      setSelectedId(first.id);
      setDraft({ ...first, buttons: Array.isArray(first.buttons) ? [...first.buttons] : [] });
      const firstStyle = parseStyle(first.sectionStyleJson);
      const cardEnabled = Boolean(firstStyle.cardEnabled);
      const cardCreated = Boolean(firstStyle.cardCreated);
      const cardContentCreated = Boolean(firstStyle.cardContentCreated);
      setSteps({
        step1: "done",
        step2: first.title || first.description ? "done" : "open",
        step3: first.title || first.description ? "open" : "locked",
        step4: cardEnabled && cardCreated ? (cardContentCreated ? "done" : "open") : "locked",
      });
    } catch {
      setError("목록을 불러오지 못했습니다.");
      setSections([]);
      setSelectedId(null);
      setDraft(null);
      setSteps(INITIAL_STEPS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSections(page);
  }, [page]);

  const persistDraft = async (next: PageSection): Promise<PageSection | null> => {
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

  const setStepOpen = (step: StepKey) => {
    const next: Record<StepKey, StepState> = { ...INITIAL_STEPS };
    for (const key of STEP_ORDER) {
      if (key === step) {
        next[key] = "open";
        break;
      }
      next[key] = "done";
    }
    setSteps(next);
  };

  const completeStep1 = async () => {
    setError("");
    setMessage("");
    if (step1Mode === "cta" && !step1CtaLink.trim()) {
      setError("CTA를 선택하면 링크를 입력해야 합니다.");
      return;
    }
    const stylePatch: StyleMap = {
      blockLayout: step1Layout,
      blockMode: step1Mode,
      blockCtaLink: step1CtaLink.trim(),
      blockShape: step1Shape,
      blockWidth: step1Width,
      blockHeight: step1Height,
      blockRadius: step1Radius,
      blockBorderEnabled: step1BorderEnabled,
      blockBorderColor: step1BorderColor,
      blockBgImage: step1BgImage.trim(),
    };

    if (step1IsEditMode && draft) {
      const next: PageSection = {
        ...draft,
        backgroundColor: step1BgColor,
        sectionStyleJson: toStyleJson({ ...parseStyle(draft.sectionStyleJson), ...stylePatch }),
      };
      setDraft(next);
      const saved = await persistDraft(next);
      if (!saved) return;
      setSections((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      setDraft(saved);
      setStep1IsEditMode(false);
      setSteps({ step1: "done", step2: "open", step3: "locked", step4: "locked" });
      setMessage("STEP 1 완료");
      return;
    }

    setBusy(true);
    try {
      const sortOrder = sections.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
      const payload = buildNewSection(page, createType, sortOrder);
      payload.backgroundColor = step1BgColor;
      payload.sectionStyleJson = toStyleJson(stylePatch);
      payload.externalUrl = step1Mode === "cta" ? step1CtaLink.trim() : null;
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
      const nextRows = [...sections, created].sort((a, b) => a.sortOrder - b.sortOrder);
      setSections(nextRows);
      setSelectedId(created.id);
      setDraft({ ...created, buttons: Array.isArray(created.buttons) ? [...created.buttons] : [] });
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
    const saved = await persistDraft(draft);
    if (!saved) return;
    const nextDraft = { ...saved, buttons: Array.isArray(saved.buttons) ? [...saved.buttons] : [] };
    setSections((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    setDraft(nextDraft);
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
    const saved = await persistDraft(next);
    if (!saved) return;
    setSections((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
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
    const saved = await persistDraft(next);
    if (!saved) return;
    setSections((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    setDraft(saved);
    setSteps({ step1: "done", step2: "done", step3: "done", step4: "done" });
    setMessage("STEP 4 완료");
  };

  const toggleHidden = async () => {
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
      setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (selectedId === updated.id) setDraft(updated);
      setMessage(updated.isVisible ? "보이기 상태" : "숨김 상태");
    } catch {
      setError("숨김 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
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
      const nextRows = [...sections, created].sort((a, b) => a.sortOrder - b.sortOrder);
      setSections(nextRows);
      setSelectedId(created.id);
      setDraft(created);
      setMessage("복제 완료");
    } catch {
      setError("복제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const deleteOrRestoreSelected = async () => {
    if (!selectedId) return;
    const current = sections.find((s) => s.id === selectedId);
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const action = current.deletedAt ? "restoreSection" : "softDeleteSection";
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: selectedId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "처리에 실패했습니다.");
        return;
      }
      const updated = data as PageSection;
      setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDraft(updated);
      setMessage(updated.deletedAt ? "삭제됨" : "복원됨");
    } catch {
      setError("처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const moveSelected = async (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const to = selectedIndex + direction;
    if (to < 0 || to >= sections.length) return;
    const reordered = [...sections];
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
        body: JSON.stringify({ action: "reorder", page, orderedIds: reordered.map((s) => s.id) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "순서 변경에 실패했습니다.");
        return;
      }
      await loadSections(page);
      setMessage("순서 변경 완료");
    } catch {
      setError("순서 변경 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const openStepForEdit = (step: StepKey) => {
    if (step === "step1") {
      setStep1IsEditMode(true);
      if (draft) {
        const s = parseStyle(draft.sectionStyleJson);
        setStep1Layout(String(s.blockLayout ?? "boxed") === "full" ? "full" : "boxed");
        setStep1Mode(String(s.blockMode ?? "cms") === "cta" ? "cta" : "cms");
        setStep1CtaLink(String(s.blockCtaLink ?? draft.externalUrl ?? ""));
        setStep1Shape(String(s.blockShape ?? "square") === "circle" ? "circle" : "square");
        setStep1Width(Number(s.blockWidth ?? 0));
        setStep1Height(Number(s.blockHeight ?? 0));
        setStep1Radius(Number(s.blockRadius ?? 12));
        setStep1BorderEnabled(Boolean(s.blockBorderEnabled));
        setStep1BgColor(String(draft.backgroundColor ?? "#ffffff"));
        setStep1BorderColor(String(s.blockBorderColor ?? "#d1d5db"));
        setStep1BgImage(String(s.blockBgImage ?? ""));
      }
    }
    setStepOpen(step);
  };

  const selectSection = (id: string) => {
    const found = sections.find((s) => s.id === id);
    if (!found) return;
    setSelectedId(id);
    setDraft({ ...found, buttons: Array.isArray(found.buttons) ? [...found.buttons] : [] });
    const s = parseStyle(found.sectionStyleJson);
    const cardEnabled = Boolean(s.cardEnabled);
    const cardCreated = Boolean(s.cardCreated);
    const cardContentCreated = Boolean(s.cardContentCreated);
    setSteps({
      step1: "done",
      step2: "open",
      step3: "locked",
      step4: "locked",
    });
    if (found.title || found.description) {
      setSteps({
        step1: "done",
        step2: "done",
        step3: "open",
        step4: cardEnabled && cardCreated ? (cardContentCreated ? "done" : "open") : "locked",
      });
    }
  };

  const updateDraftField = (patch: Partial<PageSection>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateStyle = (patch: StyleMap) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextStyle = { ...parseStyle(prev.sectionStyleJson), ...patch };
      return { ...prev, sectionStyleJson: toStyleJson(nextStyle) };
    });
  };

  const blockButtons = (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => openStepForEdit("step2")} disabled={!selectedId || busy} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">수정</button>
      <button type="button" onClick={() => void deleteOrRestoreSelected()} disabled={!selectedId || busy} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">삭제</button>
      <button type="button" onClick={() => void toggleHidden()} disabled={!selectedId || busy} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">숨김/보이기</button>
      <button type="button" onClick={() => void duplicateSelected()} disabled={!selectedId || busy} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">복제</button>
      <button type="button" onClick={() => void moveSelected(-1)} disabled={!selectedId || busy || selectedIndex <= 0} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">위로 이동</button>
      <button type="button" onClick={() => void moveSelected(1)} disabled={!selectedId || busy || selectedIndex < 0 || selectedIndex >= sections.length - 1} className="rounded border border-site-border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">아래로 이동</button>
    </div>
  );

  const previewPanel = (
    <div className="space-y-2">
      <div className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        <p className="text-xs text-gray-500 dark:text-slate-400">모바일 미리보기</p>
      </div>
      <div className="min-h-[420px] space-y-2 rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        {previewSections.map((row) => {
          const s = parseStyle(row.sectionStyleJson);
          const selected = row.id === selectedId;
          const blockWidth = Number(s.blockWidth ?? 0);
          const blockHeight = Number(s.blockHeight ?? 0);
          const blockRadius = Number(s.blockRadius ?? 12);
          const borderEnabled = Boolean(s.blockBorderEnabled);
          const borderColor = String(s.blockBorderColor ?? "#d1d5db");
          const bgImage = String(s.blockBgImage ?? "");
          const cardEnabled = Boolean(s.cardEnabled);
          const cardColor = String(s.cardColor ?? "#ffffff");
          const cardRadius = Number(s.cardRadius ?? 12);
          const titleColor = String(s.titleColor ?? "#111827");
          const titleWeight = String(s.titleWeight ?? "700");
          const titleSize = Number(s.titleSize ?? 18);
          const contentColor = String(s.contentColor ?? "#374151");
          const contentSize = Number(s.contentSize ?? 14);
          const textAlign = String(s.titleAlign ?? row.textAlign ?? "left") as "left" | "center" | "right";
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => selectSection(row.id)}
              className={`w-full rounded-xl p-3 text-left ${selected ? "ring-2 ring-blue-500" : "ring-1 ring-site-border"} ${row.deletedAt ? "opacity-50" : ""}`}
              style={{
                backgroundColor: row.backgroundColor || "#ffffff",
                borderStyle: borderEnabled ? "solid" : "none",
                borderColor,
                borderWidth: borderEnabled ? 1 : 0,
                borderRadius: `${blockRadius}px`,
                width: blockWidth > 0 ? `${Math.min(blockWidth, 560)}px` : "100%",
                maxWidth: "100%",
                minHeight: blockHeight > 0 ? `${Math.min(blockHeight, 420)}px` : undefined,
                backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <p className="text-[11px] text-gray-500 dark:text-slate-400">{row.isVisible ? "보이는 상태" : "숨김 상태"}</p>
              {row.title?.trim() ? (
                <p
                  className="mt-2"
                  style={{
                    textAlign,
                    fontSize: `${titleSize}px`,
                    fontWeight: titleWeight === "400" ? 400 : titleWeight === "500" ? 500 : 700,
                    color: titleColor,
                  }}
                >
                  {row.title}
                </p>
              ) : null}
              {row.description?.trim() ? (
                <p className="mt-1" style={{ textAlign, fontSize: `${contentSize}px`, color: contentColor }}>
                  {row.description}
                </p>
              ) : null}
              {cardEnabled ? (
                <div
                  className="mt-3 border p-2"
                  style={{
                    backgroundColor: cardColor,
                    borderRadius: `${cardRadius}px`,
                    borderColor: String(s.cardBorderColor ?? "#d1d5db"),
                    borderWidth: Boolean(s.cardBorderEnabled) ? 1 : 0,
                    borderStyle: Boolean(s.cardBorderEnabled) ? "solid" : "none",
                  }}
                >
                  <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{String(s.cardTitleText ?? "카드 제목")}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">{String(s.cardBodyText ?? "카드 내용")}</p>
                </div>
              ) : null}
            </button>
          );
        })}
        {previewSections.length === 0 ? (
          <div className="rounded border border-dashed border-site-border p-4 text-sm text-gray-500 dark:text-slate-400">
            아직 생성된 블록이 없습니다.
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        <p className="mb-2 text-xs font-medium text-gray-600 dark:text-slate-400">블록 작업</p>
        {blockButtons}
      </div>
    </div>
  );

  const stepHeader = (
    <div className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-site-text">페이지빌더 v2</h1>
        <select
          value={page}
          onChange={(e) => setPage(e.target.value as BuilderPage)}
          className="rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-900"
        >
          {PAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">단계별로 필요한 항목만 열립니다.</p>
      {message ? <p className="mt-1 text-xs text-green-700 dark:text-green-300">{message}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );

  const stepPanel = (
    <div className="space-y-2">
      {stepHeader}

      {steps.step1 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 1: 블록 생성</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">외형만 설정합니다. 제목/내용/카드 항목은 아직 보이지 않습니다.</p>
          {!step1IsEditMode ? (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-gray-600 dark:text-slate-400">블록 종류</span>
              <select value={createType} onChange={(e) => setCreateType(e.target.value as SectionType)} className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                <option value="text">텍스트 블록</option>
                <option value="image">이미지 블록</option>
                <option value="cta">CTA 블록</option>
              </select>
            </label>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select value={step1Layout} onChange={(e) => setStep1Layout(e.target.value as "full" | "boxed")} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="full">전체형</option>
              <option value="boxed">박스형</option>
            </select>
            <select value={step1Mode} onChange={(e) => setStep1Mode(e.target.value as CtaMode)} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="cms">CMS</option>
              <option value="cta">CTA</option>
            </select>
            {step1Mode === "cta" ? (
              <input value={step1CtaLink} onChange={(e) => setStep1CtaLink(e.target.value)} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
            ) : null}
            <select value={step1Shape} onChange={(e) => setStep1Shape(e.target.value as "circle" | "square")} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
              <option value="circle">원형</option>
              <option value="square">사각형</option>
            </select>
            <input type="number" value={step1Width} onChange={(e) => setStep1Width(Number(e.target.value || 0))} placeholder="크기(가로 px)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <input type="number" value={step1Height} onChange={(e) => setStep1Height(Number(e.target.value || 0))} placeholder="크기(세로 px)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <input type="number" value={step1Radius} onChange={(e) => setStep1Radius(Number(e.target.value || 0))} placeholder="모서리(px)" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
            <label className="flex items-center gap-2 rounded border border-site-border px-3 py-2 text-sm">
              <input type="checkbox" checked={step1BorderEnabled} onChange={(e) => setStep1BorderEnabled(e.target.checked)} />
              외곽선
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-600 dark:text-slate-400">배경색상</span>
              <input type="color" value={step1BgColor} onChange={(e) => setStep1BgColor(e.target.value)} className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-gray-600 dark:text-slate-400">외곽선색상</span>
              <input type="color" value={step1BorderColor} onChange={(e) => setStep1BorderColor(e.target.value)} className="h-10 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
            </label>
            <input value={step1BgImage} onChange={(e) => setStep1BgImage(e.target.value)} placeholder="배경이미지 URL" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
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
              <p className="text-xs text-gray-500 dark:text-slate-400">{getStepSummary("step1", draft)}</p>
            </div>
            <button type="button" onClick={() => openStepForEdit("step1")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">블록 수정</button>
          </div>
        </section>
      ) : null}

      {steps.step2 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 2: 블록 내용 입력</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">카드 관련 UI는 표시되지 않습니다.</p>
          {draft ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-slate-400">제목</p>
                <input value={draft.title} onChange={(e) => updateDraftField({ title: e.target.value })} placeholder="제목 입력" className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="number" value={Number(style.titleSize ?? 18)} onChange={(e) => updateStyle({ titleSize: Number(e.target.value || 18) })} placeholder="폰트 크기" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  <select value={String(style.titleWeight ?? "700")} onChange={(e) => updateStyle({ titleWeight: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="400">보통</option>
                    <option value="500">중간</option>
                    <option value="700">굵게</option>
                  </select>
                  <input type="color" value={String(style.titleColor ?? "#111827")} onChange={(e) => updateStyle({ titleColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
                  <select value={String(style.titleAlign ?? draft.textAlign)} onChange={(e) => { updateStyle({ titleAlign: e.target.value }); updateDraftField({ textAlign: e.target.value as TextAlign }); }} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="left">왼쪽 정렬</option>
                    <option value="center">가운데 정렬</option>
                    <option value="right">오른쪽 정렬</option>
                  </select>
                  <select value={String(style.titlePosition ?? "top")} onChange={(e) => updateStyle({ titlePosition: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="top">위치: 상단</option>
                    <option value="middle">위치: 중앙</option>
                    <option value="bottom">위치: 하단</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-slate-400">내용</p>
                <textarea value={draft.description ?? ""} onChange={(e) => updateDraftField({ description: e.target.value })} placeholder="내용 입력" className="min-h-24 w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="number" value={Number(style.contentSize ?? 14)} onChange={(e) => updateStyle({ contentSize: Number(e.target.value || 14) })} placeholder="폰트 크기" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  <select value={String(style.contentWeight ?? "400")} onChange={(e) => updateStyle({ contentWeight: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="400">보통</option>
                    <option value="500">중간</option>
                    <option value="700">굵게</option>
                  </select>
                  <input type="color" value={String(style.contentColor ?? "#374151")} onChange={(e) => updateStyle({ contentColor: e.target.value })} className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900" />
                  <select value={String(style.contentAlign ?? draft.textAlign)} onChange={(e) => updateStyle({ contentAlign: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="left">정렬: 왼쪽</option>
                    <option value="center">정렬: 가운데</option>
                    <option value="right">정렬: 오른쪽</option>
                  </select>
                  <select value={String(style.contentMode ?? "cms")} onChange={(e) => updateStyle({ contentMode: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="cms">CMS</option>
                    <option value="cta">CTA</option>
                  </select>
                  {String(style.contentMode ?? "cms") === "cta" ? (
                    <input value={String(style.contentCtaLink ?? "")} onChange={(e) => updateStyle({ contentCtaLink: e.target.value })} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                  ) : null}
                </div>
                {Array.isArray(style.contentExtras) ? (
                  (style.contentExtras as unknown[]).map((item, idx) => (
                    <input
                      key={`content-extra-${idx}`}
                      value={String(item ?? "")}
                      onChange={(e) => {
                        const next = [...((style.contentExtras as unknown[]) ?? [])];
                        next[idx] = e.target.value;
                        updateStyle({ contentExtras: next });
                      }}
                      placeholder={`추가 내용 ${idx + 1}`}
                      className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                    />
                  ))
                ) : null}
                <button type="button" onClick={() => updateStyle({ contentExtras: [...(((style.contentExtras as unknown[]) ?? [])), ""] })} className="rounded border border-site-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">
                  내용추가+
                </button>
              </div>

              <button type="button" onClick={() => void completeStep2()} disabled={saving} className="rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">
                STEP 2 완료
              </button>
            </div>
          ) : null}
        </section>
      ) : steps.step2 === "done" ? (
        <section className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-site-text">STEP 2: 블록 내용 입력 (완료)</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{getStepSummary("step2", draft)}</p>
            </div>
            <button type="button" onClick={() => openStepForEdit("step2")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">내용 수정</button>
          </div>
        </section>
      ) : null}

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
                  <select value={String(style.cardKind ?? "default")} onChange={(e) => updateStyle({ cardKind: e.target.value as CardKind })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="default">디폴트 카드</option>
                    <option value="custom">사용자설정 카드</option>
                  </select>
                  <select value={String(style.cardMode ?? "cms")} onChange={(e) => updateStyle({ cardMode: e.target.value })} className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900">
                    <option value="cms">CMS</option>
                    <option value="cta">CTA</option>
                  </select>
                  {String(style.cardMode ?? "cms") === "cta" ? (
                    <input value={String(style.cardCtaLink ?? "")} onChange={(e) => updateStyle({ cardCtaLink: e.target.value })} placeholder="CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
                  ) : null}
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
              <p className="text-xs text-gray-500 dark:text-slate-400">{getStepSummary("step3", draft)}</p>
            </div>
            <button type="button" onClick={() => openStepForEdit("step3")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">카드 수정</button>
          </div>
        </section>
      ) : null}

      {steps.step4 === "open" ? (
        <section className="rounded-xl border border-site-border bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-site-text">STEP 4: 카드 내용 입력</h2>
          {draft ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
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
                <input value={String(style.cardBackgroundImage ?? "")} onChange={(e) => updateStyle({ cardBackgroundImage: e.target.value })} placeholder="배경이미지 URL" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input value={String(style.cardTitleText ?? "")} onChange={(e) => updateStyle({ cardTitleText: e.target.value })} placeholder="카드 제목 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                {String(style.cardKind ?? "default") === "default" ? (
                  <input value={String(style.cardTitleField ?? "")} onChange={(e) => updateStyle({ cardTitleField: e.target.value })} placeholder="디폴트 카드 제목 필드 매핑" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900" />
                ) : null}
                <textarea value={String(style.cardBodyText ?? "")} onChange={(e) => updateStyle({ cardBodyText: e.target.value })} placeholder="카드 내용 입력" className="min-h-20 rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
                {String(style.cardKind ?? "default") === "default" ? (
                  <input value={String(style.cardBodyField ?? "")} onChange={(e) => updateStyle({ cardBodyField: e.target.value })} placeholder="디폴트 카드 내용 필드 매핑" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
                ) : null}
                {Array.isArray(style.cardExtras) ? (
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
                <button type="button" onClick={() => updateStyle({ cardExtras: [...(((style.cardExtras as unknown[]) ?? [])), ""] })} className="rounded border border-site-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 sm:col-span-2">
                  내용추가+
                </button>
                {String(style.cardKind ?? "default") === "custom" && String(style.cardMode ?? "cms") === "cta" ? (
                  <input value={String(style.cardCustomCtaLink ?? "")} onChange={(e) => updateStyle({ cardCustomCtaLink: e.target.value })} placeholder="사용자설정 카드 CTA 링크 입력" className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900 sm:col-span-2" />
                ) : null}
              </div>
              <button type="button" onClick={() => void completeStep4()} disabled={saving} className="rounded border border-site-border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800">
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
              <p className="text-xs text-gray-500 dark:text-slate-400">{getStepSummary("step4", draft)}</p>
            </div>
            <button type="button" onClick={() => openStepForEdit("step4")} className="rounded border border-site-border px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">카드 내용 수정</button>
          </div>
        </section>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-2 px-2 py-2">
        {stepHeader}
        <div className="rounded-xl border border-site-border bg-white p-6 text-sm text-gray-500 dark:bg-slate-900 dark:text-slate-400">
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2 px-2 py-2 md:px-3 md:py-3">
      {isMobile ? (
        <div className="space-y-2">
          {previewPanel}
          {stepPanel}
        </div>
      ) : (
        <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 gap-2 lg:grid-cols-[1.8fr_1fr]">
          {previewPanel}
          {stepPanel}
        </div>
      )}
    </div>
  );
}
