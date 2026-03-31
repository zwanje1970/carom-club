"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiContentCopy,
  mdiDeleteOutline,
  mdiEye,
  mdiEyeOff,
  mdiFormatVerticalAlignBottom,
  mdiFormatVerticalAlignTop,
} from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/components/admin/_components/Button";
import CardBox from "@/components/admin/_components/CardBox";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import type { PageSection, PageSectionSlotType, PlacementSlug, SectionType } from "@/types/page-section";
import { getAllowedBuilderPageOptions, type PageBuilderKey } from "@/lib/content/page-section-page-rules";
import { PAGE_LABELS, PLACEMENT_LABELS, SECTION_TYPE_LABELS } from "@/lib/content/constants";
import {
  buildPageLayoutSectionPayload,
  PAGE_SECTION_SLOT_LABELS,
  type PageLayoutAddTemplate,
} from "@/lib/content/page-layout-admin";
import { SectionEditor } from "@/components/admin/page-builder/SectionEditor";
import { PageBuilderMobilePreview } from "@/components/admin/page-builder/PageBuilderMobilePreview";
import { CmsDraftToolbar } from "@/components/admin/cms-v2/CmsDraftToolbar";
import { isHomeStructureSlotType } from "@/lib/home-structure-slots";
const BUILDER_PAGES: PageBuilderKey[] = ["home", "community", "tournaments"];
const AUTO_CARD_SOURCE_OPTIONS = [
  { key: "tournament", label: "대회" },
  { key: "club", label: "당구장" },
  { key: "etc", label: "기타" },
] as const;

const SLOT_TYPES: PageSectionSlotType[] = [
  "hero",
  "noticeOverlay",
  "cmsPageSections",
  "quickMenu",
  "homeCarousels",
  "tournamentIntro",
  "venueIntro",
  "venueLink",
  "nanguEntry",
  "postList",
  "nanguList",
  "tournamentList",
];

type AddOptionValue =
  | "cms:text"
  | "cms:image"
  | "cms:cta"
  | `slot:${PageSectionSlotType}`;

function parseAddOption(v: AddOptionValue): PageLayoutAddTemplate {
  if (v.startsWith("cms:")) {
    const t = v.slice(4) as SectionType;
    return { kind: "cms", sectionType: t };
  }
  const st = v.slice(5) as PageSectionSlotType;
  return { kind: "slot", slotType: st };
}

function rowLabel(s: PageSection) {
  if (s.slotType) {
    const slotLabel = PAGE_SECTION_SLOT_LABELS[s.slotType] ?? s.slotType;
    if (isHomeStructureSlotType(s.slotType)) {
      return slotLabel;
    }
    const titlePart = s.title?.trim() ? ` · ${s.title}` : "";
    return `${slotLabel}${titlePart}`;
  }
  return `${SECTION_TYPE_LABELS[s.type]} · ${s.title || "(제목 없음)"}`;
}

function metaLine(s: PageSection, index: number) {
  const placement = PLACEMENT_LABELS[s.placement];
  const period =
    s.startAt || s.endAt
      ? ` · 기간 ${s.startAt ? new Date(s.startAt).toLocaleString("ko-KR") : "—"} ~ ${s.endAt ? new Date(s.endAt).toLocaleString("ko-KR") : "—"}`
      : "";
  return `${placement} · ${index + 1}번째${period}`;
}

export type PageBuilderClientProps = {
  /** 운영자 CMS 통합 화면에서는 "블록" 용어 사용 */
  terminology?: "section" | "block";
  /** 사이트관리 → 콘텐츠 편집: 초안·게시 툴바 */
  draftToolbar?: boolean;
};

function emptyListMessage(term: "section" | "block") {
  return term === "block"
    ? "이 페이지에 등록된 블록이 없습니다. 아래에서 추가할 수 있습니다."
    : "이 페이지에 등록된 섹션이 없습니다. 아래에서 추가할 수 있습니다.";
}

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err && typeof err === "object" && "type" in err) {
    const eventType = String((err as { type?: unknown }).type ?? "unknown");
    return new Error(`${fallback} (event: ${eventType})`);
  }
  return new Error(fallback);
}

type ManualCardItem = {
  id: string;
  imageUrl: string | null;
  title: string;
  description: string;
  link: string;
  shape: "soft" | "square" | "pill";
  color: string;
  size: "sm" | "md" | "lg";
  ratio: "16:9" | "4:3" | "1:1";
};

function parseStyleMap(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toStyleJson(map: Record<string, unknown>): string {
  return JSON.stringify(map);
}

function getStyleValue<T>(section: PageSection | null, key: string, fallback: T): T {
  if (!section) return fallback;
  const map = parseStyleMap(section.sectionStyleJson);
  return (map[key] as T) ?? fallback;
}

function nextManualCard(): ManualCardItem {
  return {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageUrl: null,
    title: "",
    description: "",
    link: "",
    shape: "soft",
    color: "#ffffff",
    size: "md",
    ratio: "16:9",
  };
}

function syncRowsPlacement(rows: PageSection[]): PageSection[] {
  const placementOrder = Object.keys(PLACEMENT_LABELS) as PlacementSlug[];
  return rows.map((row, index) => ({
    ...row,
    placement: placementOrder[Math.min(index, placementOrder.length - 1)],
  }));
}

function normalizeAutoDataTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return ["tournament"];
  const normalized = value.filter((item): item is string => typeof item === "string");
  return normalized.length > 0 ? normalized : ["tournament"];
}

export function PageBuilderClient({ terminology = "section", draftToolbar = false }: PageBuilderClientProps) {
  type BuilderToolMode = "edit" | "move" | "duplicate";
  const term = terminology;
  const [page, setPage] = useState<PageBuilderKey>("home");
  const [rows, setRows] = useState<PageSection[]>([]);
  const rowsRef = useRef<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addValue, setAddValue] = useState<AddOptionValue>("cms:text");
  const [activeTool, setActiveTool] = useState<{ id: string; mode: BuilderToolMode } | null>(null);
  /** 홈 구조 슬롯 스타일·CTA 미리보기용 `sectionStyleJson` 누적 (패널을 닫거나 다른 행을 열면 초기화) */
  const [slotSectionStyleDraft, setSlotSectionStyleDraft] = useState<Record<string, string>>({});
  /** 홈 콘텐츠 입력(저장 전) 미리보기용 드래프트 */
  const [contentDraftById, setContentDraftById] = useState<Record<string, PageSection>>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ hasDraft: boolean; updatedAt: string | null } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState<"list" | "edit" | "preview">("list");
  const [editorDraft, setEditorDraft] = useState<PageSection | null>(null);
  const [editorSaveState, setEditorSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef<Record<string, string>>({});
  const listPanelRef = useRef<HTMLDivElement | null>(null);

  const closeEditor = () => {
    if (isMobile) {
      setMobileStep("list");
      return;
    }
    setActiveTool(null);
  };

  const openTool = (id: string, mode: BuilderToolMode) => {
    setActiveTool({ id, mode });
    if (isMobile) setMobileStep(mode === "edit" ? "edit" : "list");
  };

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!activeTool?.id) return;
    const panel = listPanelRef.current;
    if (!panel) return;
    const target = panel.querySelector(`[data-row-id="${activeTool.id}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeTool?.id, rows.length]);

  useEffect(() => {
    // 페이지 전환 시 선택 상태/입력 드래프트를 초기화한다.
    setActiveTool(null);
    setSlotSectionStyleDraft({});
    setContentDraftById({});
    setMobileStep("list");
  }, [page]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/content/page-layout?page=${encodeURIComponent(page)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "불러오기에 실패했습니다.");
        setRows([]);
        return;
      }
      const nextRows = syncRowsPlacement(Array.isArray(data) ? data : []);
      setRows(nextRows);
      // 서버 최신 목록 로드 시, 더 이상 존재하지 않는 임시 드래프트를 정리한다.
      setContentDraftById((prev) => {
        const idSet = new Set(nextRows.map((r) => r.id));
        const next: Record<string, PageSection> = {};
        for (const [id, draft] of Object.entries(prev)) {
          if (idSet.has(id)) next[id] = draft;
        }
        return next;
      });
    } catch (err) {
      const error = toError(err, "페이지 목록을 불러오지 못했습니다.");
      console.error("[PageBuilderClient] load failed", { page, error, original: err });
      setError(error.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(async (nextRows: PageSection[]) => {
    const ids = nextRows.map((r) => r.id);
    const res = await fetch("/api/admin/content/page-layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", page, orderedIds: ids }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      console.error("[PageBuilderClient] reorder API failed", {
        page,
        status: res.status,
        statusText: res.statusText,
        response: d,
      });
      throw new Error(typeof d.error === "string" ? d.error : "순서 저장에 실패했습니다.");
    }
  }, [page]);

  const handleReorderCommit = useCallback(
    async (next: PageSection[]) => {
      const syncedNext = syncRowsPlacement(next);
      const prevSnapshot = rowsRef.current;
      rowsRef.current = syncedNext;
      setRows(syncedNext);
      setBusyId("reorder");
      try {
        await persistOrder(syncedNext);
      } catch (e) {
        const error = toError(e, "순서 저장 중 오류가 발생했습니다.");
        console.error("[PageBuilderClient] reorder commit failed", { page, error, original: e });
        rowsRef.current = prevSnapshot;
        setRows(prevSnapshot);
        alert(error.message);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [persistOrder, load]
  );

  const move = async (index: number, dir: -1 | 1) => {
    const current = rowsRef.current;
    const j = index + dir;
    if (j < 0 || j >= current.length) return;
    const next = [...current];
    const t = next[index];
    next[index] = next[j];
    next[j] = t;
    await handleReorderCommit(next);
  };

  const moveToEnd = async (index: number, dest: "first" | "last") => {
    const current = rowsRef.current;
    if (current.length <= 1) return;
    const item = current[index];
    const rest = current.filter((_, i) => i !== index);
    const next = dest === "first" ? [item, ...rest] : [...rest, item];
    await handleReorderCommit(next);
  };

  const moveSectionByPlacement = async (sectionId: string, placement: PlacementSlug) => {
    const current = rowsRef.current;
    const currentIndex = current.findIndex((row) => row.id === sectionId);
    if (currentIndex < 0) return;
    const placementOrder = Object.keys(PLACEMENT_LABELS) as PlacementSlug[];
    const targetIndex = Math.min(
      Math.max(placementOrder.indexOf(placement), 0),
      Math.max(0, current.length - 1)
    );
    if (targetIndex === currentIndex) return;
    const next = [...current];
    const [item] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, item);
    await handleReorderCommit(next);
  };

  const toggleVisible = async (s: PageSection) => {
    setBusyId(s.id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "visibility", id: s.id, isVisible: !s.isVisible }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[PageBuilderClient] visibility API failed", {
          page,
          sectionId: s.id,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        alert(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === s.id ? (data as PageSection) : r)));
      setContentDraftById((prev) => {
        if (!(s.id in prev)) return prev;
        const { [s.id]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const error = toError(err, "표시 상태 저장 중 오류가 발생했습니다.");
      console.error("[PageBuilderClient] toggleVisible failed", { page, sectionId: s.id, error, original: err });
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const softRemove = async (id: string) => {
    if (
      !window.confirm(
        "이 블록을 소프트 삭제합니다. 공개 페이지에서는 제외되며, 여기서 복원할 수 있습니다. 계속할까요?"
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "softDeleteSection", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[PageBuilderClient] soft delete API failed", {
          page,
          sectionId: id,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        alert(typeof data?.error === "string" ? data.error : "삭제 처리에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? (data as PageSection) : r)));
      setContentDraftById((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const error = toError(err, "블록 삭제 중 오류가 발생했습니다.");
      console.error("[PageBuilderClient] softRemove failed", { page, sectionId: id, error, original: err });
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restoreSection", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[PageBuilderClient] restore API failed", {
          page,
          sectionId: id,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        alert(typeof data?.error === "string" ? data.error : "복원에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? (data as PageSection) : r)));
      setContentDraftById((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const error = toError(err, "블록 복원 중 오류가 발생했습니다.");
      console.error("[PageBuilderClient] restore failed", { page, sectionId: id, error, original: err });
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const addSection = async () => {
    const template = parseAddOption(addValue);
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ps-${Date.now()}`;
    const maxOrder = rowsRef.current.reduce((m, r) => Math.max(m, r.sortOrder), -1);
    const nextSort = maxOrder + 1;
    const payload = buildPageLayoutSectionPayload(page, template, nextSort, id);
    setBusyId("add");
    try {
      const res = await fetch("/api/admin/content/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("[PageBuilderClient] add API failed", {
          page,
          status: res.status,
          statusText: res.statusText,
          payload,
          response: data,
        });
        alert(typeof data?.error === "string" ? data.error : "추가에 실패했습니다.");
        return;
      }
      const saved = data as PageSection;
      setRows((prev) => {
        const exists = prev.some((r) => r.id === saved.id);
        if (exists) return syncRowsPlacement(prev.map((r) => (r.id === saved.id ? saved : r)));
        return syncRowsPlacement([...prev, saved]);
      });
      rowsRef.current = syncRowsPlacement([...rowsRef.current.filter((r) => r.id !== saved.id), saved]);
      setActiveTool({ id: saved.id, mode: "edit" });
      if (isMobile) setMobileStep("edit");
    } catch (err) {
      const error = toError(err, "블록 추가 중 오류가 발생했습니다.");
      console.error("[PageBuilderClient] addSection failed", { page, payload, error, original: err });
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const runDraftAction = async (action: "ensureSave" | "publish" | "reset") => {
    if (!draftToolbar) return;
    setBusyId(action);
    try {
      const res = await fetch("/api/admin/content/cms-page-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, page }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "요청을 처리하지 못했습니다.");
        return;
      }
      await load();
    } catch (err) {
      const error = toError(err, "초안/게시 처리 중 오류가 발생했습니다.");
      alert(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const patchDraft = (patch: Partial<PageSection>) => {
    setEditorDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchStyle = (patch: Record<string, unknown>) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const current = parseStyleMap(prev.sectionStyleJson);
      const next = { ...current, ...patch };
      return { ...prev, sectionStyleJson: toStyleJson(next) };
    });
  };

  const reorderDisabled = busyId !== null;

  const mergedRows = useMemo(() => {
    return rows.map((r) => contentDraftById[r.id] ?? r);
  }, [rows, contentDraftById]);

  const previewRows = useMemo(() => {
    return mergedRows.map((r) => {
      const d = slotSectionStyleDraft[r.id];
      if (d === undefined) return r;
      return { ...r, sectionStyleJson: d };
    });
  }, [mergedRows, slotSectionStyleDraft]);

  const activeSection = useMemo(() => {
    if (!activeTool) return null;
    return mergedRows.find((r) => r.id === activeTool.id) ?? null;
  }, [mergedRows, activeTool]);

  useEffect(() => {
    setEditorDraft(activeSection ? { ...activeSection, buttons: [...activeSection.buttons] } : null);
    setEditorSaveState("idle");
  }, [activeSection?.id]);

  useEffect(() => {
    if (!activeSection || !editorDraft || activeSection.id !== editorDraft.id) return;
    if (activeSection.placement === editorDraft.placement) return;
    setEditorDraft((prev) => (prev && prev.id === activeSection.id ? { ...prev, placement: activeSection.placement } : prev));
  }, [activeSection?.id, activeSection?.placement, editorDraft]);

  useEffect(() => {
    if (mergedRows.length === 0) return;
    if (activeSection) return;
    setActiveTool({ id: mergedRows[0].id, mode: "edit" });
  }, [mergedRows, activeSection]);

  useEffect(() => {
    if (!editorDraft) return;
    if (!activeSection || editorDraft.id !== activeSection.id) return;
    const { createdAt: _c, updatedAt: _u, ...payload } = editorDraft;
    const signature = JSON.stringify(payload);
    const prevSignature = lastSavedRef.current[editorDraft.id];
    if (prevSignature === signature) return;
    setEditorSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/content/page-sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("[PageBuilderClient] unified editor autosave failed", {
            sectionId: editorDraft.id,
            status: res.status,
            statusText: res.statusText,
            response: data,
          });
          setEditorSaveState("error");
          return;
        }
        const saved = data as PageSection;
        lastSavedRef.current[saved.id] = JSON.stringify({
          ...saved,
          createdAt: undefined,
          updatedAt: undefined,
        });
        setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        setEditorSaveState("saved");
      } catch (err) {
        console.error("[PageBuilderClient] unified editor autosave error", err);
        setEditorSaveState("error");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [editorDraft, activeSection]);

  const hasDraftChanges = useMemo(
    () => Object.keys(contentDraftById).length > 0 || Object.keys(slotSectionStyleDraft).length > 0,
    [contentDraftById, slotSectionStyleDraft]
  );

  return (
    <div className="min-w-0 space-y-3">
      <CardBox>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <Link href="/admin" className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800">
            뒤로가기
          </Link>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-slate-400">페이지</span>
            <select
              className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={page}
              onChange={(e) => setPage(e.target.value as PageBuilderKey)}
            >
              {BUILDER_PAGES.map((p) => (
                <option key={p} value={p}>
                  {PAGE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <span className={`rounded px-2 py-1 text-[11px] font-medium ${
            hasDraftChanges || draftMeta?.hasDraft
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          }`}>
            {hasDraftChanges || draftMeta?.hasDraft ? "초안 상태 / 게시 필요" : "초안 상태 / 게시본과 동일"}
          </span>
          <button
            type="button"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {isFullScreen ? "전체화면 종료" : "전체화면 편집"}
          </button>
          {draftToolbar ? (
            <div className="ml-auto">
              <CmsDraftToolbar
                page={page}
                compact
                onMetaChange={setDraftMeta}
                onAfterMutation={() => void load()}
              />
            </div>
          ) : null}
        </div>
      </CardBox>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[30%_50%_20%]">
        <div className={`min-w-0 overflow-hidden ${isMobile && mobileStep !== "list" ? "hidden" : ""}`}>
          <CardBox className="h-[calc(100dvh-12rem)] overflow-y-auto">
            <div ref={listPanelRef} className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">블록 유형</span>
                <select
                  className="min-w-[12rem] rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value as AddOptionValue)}
                >
                  <optgroup label="CMS 블록">
                    <option value="cms:text">텍스트</option>
                    <option value="cms:image">이미지</option>
                    <option value="cms:cta">CTA</option>
                  </optgroup>
                  <optgroup label="구조 슬롯">
                    {SLOT_TYPES.filter((st) => getAllowedBuilderPageOptions(st, "text").includes(page)).map((st) => (
                      <option key={st} value={`slot:${st}`}>
                        {PAGE_SECTION_SLOT_LABELS[st]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <Button label="블록 추가" color="info" small disabled={loading || reorderDisabled} onClick={() => void addSection()} />
            </div>
            {loading ? (
              <p className="text-gray-500">불러오는 중…</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-500">{emptyListMessage(term)}</p>
            ) : (
              <SectionEditor
                sections={mergedRows}
                reorderDisabled={reorderDisabled}
                rowLabel={rowLabel}
                metaLine={metaLine}
                onReorderCommit={handleReorderCommit}
                activeRowId={activeTool?.id ?? null}
                onRowClick={(section) => openTool(section.id, "edit")}
                renderStatusBadges={(s) => (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                    {s.slotType ? (PAGE_SECTION_SLOT_LABELS[s.slotType] ?? s.slotType) : SECTION_TYPE_LABELS[s.type]}
                  </span>
                )}
                renderRowActions={(s, i) => (
                  <div className="rounded border border-gray-200 bg-gray-50/80 p-2 dark:border-slate-600 dark:bg-slate-800/70">
                    <div className="mb-1 flex items-center justify-end">
                      <button
                        type="button"
                        title="블록 편집"
                        disabled={reorderDisabled}
                        className={`rounded border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
                          activeTool?.id === s.id && activeTool.mode === "edit"
                            ? "border-site-primary bg-site-primary text-white dark:border-red-900 dark:bg-site-primary"
                            : "border-site-primary/40 bg-white text-site-primary hover:bg-red-50 dark:border-red-900/70 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/30"
                        }`}
                        onClick={() => openTool(s.id, "edit")}
                      >
                        편집
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button type="button" title="삭제" disabled={reorderDisabled || Boolean(s.deletedAt)} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void softRemove(s.id)}>
                        <Icon path={mdiDeleteOutline} size={0.75} />
                      </button>
                      <button type="button" title={s.isVisible ? "숨기기" : "표시"} disabled={reorderDisabled || Boolean(s.deletedAt)} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void toggleVisible(s)}>
                        <Icon path={s.isVisible ? mdiEyeOff : mdiEye} size={0.75} />
                      </button>
                      <button type="button" title="복제" disabled={reorderDisabled} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => openTool(s.id, "duplicate")}>
                        <Icon path={mdiContentCopy} size={0.75} />
                      </button>
                      <button type="button" title="맨 위" disabled={i === 0 || reorderDisabled} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void moveToEnd(i, "first")}>
                        <Icon path={mdiFormatVerticalAlignTop} size={0.75} />
                      </button>
                      <button type="button" title="위로" disabled={i === 0 || reorderDisabled} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void move(i, -1)}>
                        <Icon path={mdiChevronUp} size={0.75} />
                      </button>
                      <button type="button" title="아래로" disabled={i === rows.length - 1 || reorderDisabled} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void move(i, 1)}>
                        <Icon path={mdiChevronDown} size={0.75} />
                      </button>
                      <button type="button" title="맨 아래" disabled={i === rows.length - 1 || reorderDisabled} className="rounded border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => void moveToEnd(i, "last")}>
                        <Icon path={mdiFormatVerticalAlignBottom} size={0.75} />
                      </button>
                    </div>
                  </div>
                )}
              />
            )}
            </div>
          </CardBox>
        </div>

        <div className={`min-w-0 overflow-hidden ${isMobile && mobileStep !== "edit" ? "hidden" : ""}`}>
          <CardBox className="h-[calc(100dvh-12rem)] overflow-y-auto">
            {editorDraft ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="font-medium text-gray-700 dark:text-slate-200">
                    {editorSaveState === "saving" && "자동 저장 중..."}
                    {editorSaveState === "saved" && "자동 저장됨"}
                    {editorSaveState === "error" && "저장 실패"}
                    {editorSaveState === "idle" && "편집 중"}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-white dark:border-slate-600 dark:hover:bg-slate-900"
                    onClick={closeEditor}
                  >
                    닫기
                  </button>
                </div>
                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">1. 노출 설정</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">노출 위치</span>
                      <select
                        className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                        value={editorDraft.placement}
                        onChange={(e) => {
                          const placement = e.target.value as PlacementSlug;
                          patchDraft({ placement });
                          void moveSectionByPlacement(editorDraft.id, placement);
                        }}
                      >
                        {Object.entries(PLACEMENT_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">노출 시작</span>
                      <input
                        type="datetime-local"
                        className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                        value={editorDraft.startAt ? editorDraft.startAt.slice(0, 16) : ""}
                        onChange={(e) => {
                          patchDraft({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null });
                          e.currentTarget.blur();
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">노출 종료</span>
                      <input
                        type="datetime-local"
                        className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                        value={editorDraft.endAt ? editorDraft.endAt.slice(0, 16) : ""}
                        onChange={(e) => {
                          patchDraft({ endAt: e.target.value ? new Date(e.target.value).toISOString() : null });
                          e.currentTarget.blur();
                        }}
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">2. 형식 / 레이아웃</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">전체폭 / 박스형</span>
                      <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "layoutMode", "boxed"))} onChange={(e) => patchStyle({ layoutMode: e.target.value })}>
                        <option value="full">전체폭</option>
                        <option value="boxed">박스형</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">정렬</span>
                      <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={editorDraft.textAlign} onChange={(e) => patchDraft({ textAlign: e.target.value as PageSection["textAlign"] })}>
                        <option value="left">왼쪽</option>
                        <option value="center">가운데</option>
                        <option value="right">오른쪽</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">여백</span>
                      <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "spacing", "24"))} onChange={(e) => patchStyle({ spacing: e.target.value })} />
                    </label>
                  </div>
                </section>

                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">3. 디자인</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">배경색</span>
                      <input type="color" className="h-9 rounded border border-gray-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-900" value={editorDraft.backgroundColor ?? "#ffffff"} onChange={(e) => patchDraft({ backgroundColor: e.target.value })} />
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">배경 이미지 (첨부)</span>
                      <AdminImageField label="배경 이미지" value={String(getStyleValue(editorDraft, "bgImageUrl", "")) || null} onChange={(url) => patchStyle({ bgImageUrl: url ?? "" })} policy="section" recommendedSize="1200x675" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "borderEnabled", false))} onChange={(e) => patchStyle({ borderEnabled: e.target.checked })} />
                      테두리 ON/OFF
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">테두리 색상</span>
                      <input type="color" className="h-9 rounded border border-gray-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "borderColor", "#d1d5db"))} onChange={(e) => patchStyle({ borderColor: e.target.value })} />
                    </label>
                  </div>
                </section>

                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">4. 내용</h3>
                  <div className="mt-2 space-y-2">
                    <input className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={editorDraft.title ?? ""} onChange={(e) => patchDraft({ title: e.target.value })} placeholder="텍스트 입력" />
                    <textarea className="min-h-20 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={editorDraft.description ?? ""} onChange={(e) => patchDraft({ description: e.target.value })} placeholder="텍스트 입력" />
                    <AdminImageField label="이미지 첨부 (권장)" value={editorDraft.imageUrl} onChange={(url) => patchDraft({ imageUrl: url ?? null })} policy="section" recommendedSize="1200x675" />
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      권장 크기 1200x675, 권장 비율 16:9, 최대 5MB, 비율이 맞지 않으면 잘릴 수 있습니다. 업로드 시 자동 리사이즈/압축됩니다.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-5">
                      <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "fontFamily", "default"))} onChange={(e) => patchStyle({ fontFamily: e.target.value })}>
                        <option value="default">기본 폰트</option>
                      </select>
                      <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "fontWeight", "regular"))} onChange={(e) => patchStyle({ fontWeight: e.target.value })}>
                        <option value="regular">Regular</option>
                        <option value="medium">Medium</option>
                        <option value="bold">Bold</option>
                      </select>
                      <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "textSize", "md"))} onChange={(e) => patchStyle({ textSize: e.target.value })}>
                        <option value="sm">크기 작게</option>
                        <option value="md">크기 보통</option>
                        <option value="lg">크기 크게</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "textItalic", false))} onChange={(e) => patchStyle({ textItalic: e.target.checked })} />italic</label>
                      <input type="color" className="h-9 rounded border border-gray-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "textColor", "#111827"))} onChange={(e) => patchStyle({ textColor: e.target.value })} />
                    </div>
                  </div>
                </section>

                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">5. 링크 (CTA)</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={editorDraft.buttons?.[0]?.name ?? ""} onChange={(e) => patchDraft({ buttons: [{ ...(editorDraft.buttons?.[0] ?? { id: `btn-${editorDraft.id}`, linkType: "external", href: "", openInNewTab: false, isPrimary: true }), name: e.target.value }, ...(editorDraft.buttons?.slice(1) ?? [])] })} placeholder="버튼 문구" />
                    <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={editorDraft.buttons?.[0]?.href ?? ""} onChange={(e) => patchDraft({ buttons: [{ ...(editorDraft.buttons?.[0] ?? { id: `btn-${editorDraft.id}`, name: "", linkType: "external", href: "", openInNewTab: false, isPrimary: true }), href: e.target.value }, ...(editorDraft.buttons?.slice(1) ?? [])] })} placeholder="링크 입력 시 CTA" />
                  </div>
                </section>

                <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-semibold">6. 카드 설정</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "cardEnabled", false))} onChange={(e) => patchStyle({ cardEnabled: e.target.checked })} />카드 사용 ON/OFF</label>
                    <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "cardDisplayMode", "slide"))} onChange={(e) => patchStyle({ cardDisplayMode: e.target.value })}>
                      <option value="slide">슬라이드</option>
                      <option value="fade">페이드</option>
                      <option value="stack">스택</option>
                    </select>
                  </div>
                </section>

                {Boolean(getStyleValue(editorDraft, "cardEnabled", false)) ? (
                  <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                    <h3 className="text-sm font-semibold">하단: 카드 영역</h3>
                    <div className="mt-2 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">1. 카드 방식 선택</p>
                        <div className="mt-1 flex gap-2">
                          <button type="button" className={`rounded border px-2 py-1 text-xs ${String(getStyleValue(editorDraft, "cardMode", "auto")) === "auto" ? "border-site-primary bg-red-50 text-site-primary" : "border-gray-300"}`} onClick={() => patchStyle({ cardMode: "auto" })}>자동 (데이터 기반)</button>
                          <button type="button" className={`rounded border px-2 py-1 text-xs ${String(getStyleValue(editorDraft, "cardMode", "auto")) === "manual" ? "border-site-primary bg-red-50 text-site-primary" : "border-gray-300"}`} onClick={() => patchStyle({ cardMode: "manual" })}>수동 (직접 입력)</button>
                        </div>
                      </div>

                      {String(getStyleValue(editorDraft, "cardMode", "auto")) === "auto" ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">2. 자동 카드 설정</p>
                            <div className="mt-1 grid gap-2 sm:grid-cols-3">
                              <div className="rounded border border-gray-200 p-2 text-xs dark:border-slate-600">
                                <p className="mb-1 font-semibold text-gray-700 dark:text-slate-200">데이터 종류</p>
                                <div className="space-y-1">
                                  {AUTO_CARD_SOURCE_OPTIONS.map((option) => {
                                    const selected = normalizeAutoDataTypes(getStyleValue(editorDraft, "autoDataTypes", ["tournament"]));
                                    return (
                                      <label key={option.key} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={selected.includes(option.key)}
                                          onChange={(e) => {
                                            const next = e.target.checked
                                              ? [...new Set([...selected, option.key])]
                                              : selected.filter((key) => key !== option.key);
                                            patchStyle({ autoDataTypes: next.length > 0 ? next : ["tournament"] });
                                          }}
                                        />
                                        {option.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                              <input type="number" className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "autoCount", "6"))} onChange={(e) => patchStyle({ autoCount: Number(e.target.value || 0) })} />
                              <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "autoSort", "latest"))} onChange={(e) => patchStyle({ autoSort: e.target.value })}>
                                <option value="latest">최신순</option>
                                <option value="popular">인기순</option>
                                <option value="deadline">마감임박순</option>
                              </select>
                            </div>
                          </div>
                          <div className="rounded border border-gray-200 p-2 dark:border-slate-600">
                            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">노출 조건</p>
                            <div className="mt-1 grid gap-2 sm:grid-cols-3">
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "filterHideEnded", true))} onChange={(e) => patchStyle({ filterHideEnded: e.target.checked })} />종료 데이터 숨기기</label>
                              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "filterHideStartedPast", false))} onChange={(e) => patchStyle({ filterHideStartedPast: e.target.checked })} />시작일 지난 데이터 숨기기</label>
                              <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "filterStatus", "all"))} onChange={(e) => patchStyle({ filterStatus: e.target.value })}>
                                <option value="all">상태 필터: 전체</option>
                                <option value="scheduled">상태 필터: 예정</option>
                                <option value="ongoing">상태 필터: 진행</option>
                                <option value="ended">상태 필터: 종료</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">3. 수동 카드 설정</p>
                          {((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || []).map((card, idx) => (
                            <div key={card.id} className="rounded border border-gray-200 p-2 dark:border-slate-600">
                              <p className="mb-1 text-xs font-medium">카드 {idx + 1}</p>
                              <AdminImageField label="이미지 첨부" value={card.imageUrl} onChange={(url) => {
                                const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                items[idx] = { ...card, imageUrl: url ?? null };
                                patchStyle({ manualCards: items });
                              }} policy="section" recommendedSize="1200x675" />
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={card.title} onChange={(e) => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items[idx] = { ...card, title: e.target.value };
                                  patchStyle({ manualCards: items });
                                }} placeholder="텍스트 입력" />
                                <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={card.link} onChange={(e) => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items[idx] = { ...card, link: e.target.value };
                                  patchStyle({ manualCards: items });
                                }} placeholder="링크" />
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={card.shape} onChange={(e) => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items[idx] = { ...card, shape: e.target.value as ManualCardItem["shape"] };
                                  patchStyle({ manualCards: items });
                                }}>
                                  <option value="soft">카드 디자인: soft</option>
                                  <option value="square">카드 디자인: square</option>
                                  <option value="pill">카드 디자인: pill</option>
                                </select>
                                <input type="color" className="h-9 rounded border border-gray-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-900" value={card.color} onChange={(e) => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items[idx] = { ...card, color: e.target.value };
                                  patchStyle({ manualCards: items });
                                }} />
                                <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={card.ratio} onChange={(e) => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items[idx] = { ...card, ratio: e.target.value as ManualCardItem["ratio"] };
                                  patchStyle({ manualCards: items });
                                }}>
                                  <option value="16:9">이미지/텍스트 비율 16:9</option>
                                  <option value="4:3">이미지/텍스트 비율 4:3</option>
                                  <option value="1:1">이미지/텍스트 비율 1:1</option>
                                </select>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs" onClick={() => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items.splice(idx, 1);
                                  patchStyle({ manualCards: items });
                                }}>삭제</button>
                                <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs" onClick={() => {
                                  const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || [])];
                                  items.splice(idx + 1, 0, { ...card, id: nextManualCard().id });
                                  patchStyle({ manualCards: items });
                                }}>복제</button>
                              </div>
                            </div>
                          ))}
                          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs" onClick={() => {
                            const items = [...((getStyleValue(editorDraft, "manualCards", []) as ManualCardItem[]) || []), nextManualCard()];
                            patchStyle({ manualCards: items });
                          }}>카드 추가</button>
                        </div>
                      )}

                      <div className="rounded border border-gray-200 p-2 dark:border-slate-600">
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">4. 블록 하단 CTA</p>
                        <div className="mt-1 grid gap-2 sm:grid-cols-4">
                          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(getStyleValue(editorDraft, "blockCtaEnabled", false))} onChange={(e) => patchStyle({ blockCtaEnabled: e.target.checked })} />사용 ON/OFF</label>
                          <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "blockCtaText", ""))} onChange={(e) => patchStyle({ blockCtaText: e.target.value })} placeholder="문구" />
                          <input className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "blockCtaLink", ""))} onChange={(e) => patchStyle({ blockCtaLink: e.target.value })} placeholder="링크" />
                          <select className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900" value={String(getStyleValue(editorDraft, "blockCtaAlign", "left"))} onChange={(e) => patchStyle({ blockCtaAlign: e.target.value })}>
                            <option value="left">정렬: 왼쪽</option>
                            <option value="center">정렬: 가운데</option>
                            <option value="right">정렬: 오른쪽</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="rounded border border-gray-200 p-3 dark:border-slate-700">
                    <h3 className="text-sm font-semibold">하단: 카드 영역</h3>
                    <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">카드 ON일 때만 표시됩니다.</p>
                  </section>
                )}
              </div>
            ) : null}
          </CardBox>
        </div>

        <div className={`min-w-0 overflow-hidden ${isMobile && mobileStep !== "preview" ? "hidden" : ""}`}>
          <CardBox className="h-[calc(100dvh-12rem)] overflow-y-auto">
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-slate-200">모바일 미리보기</h3>
            <PageBuilderMobilePreview
              page={page}
              rows={loading ? [] : previewRows}
              variant="mobile"
              selectedBlockId={activeSection?.id ?? null}
              onSelectBlock={(id) => openTool(id, "edit")}
            />
          </CardBox>
        </div>
      </div>
      {isMobile && mobileStep === "edit" ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white/95 p-2 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
            <Button
              label={busyId === "ensureSave" ? "저장 중…" : "저장"}
              color="info"
              small
              disabled={busyId !== null}
              onClick={() => void runDraftAction("ensureSave")}
            />
            <Button label="나가기" color="contrast" small onClick={() => setMobileStep("list")} />
            <Button label="미리보기" color="contrast" small onClick={() => setMobileStep("preview")} />
          </div>
        </div>
      ) : null}
      {isMobile && mobileStep === "preview" ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-gray-200 bg-white/95 p-2 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
            <Button label="편집으로" color="info" small onClick={() => setMobileStep("edit")} />
            <Button label="나가기" color="contrast" small onClick={() => setMobileStep("list")} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
