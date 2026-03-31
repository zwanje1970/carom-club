"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  mdiBackupRestore,
  mdiChevronDown,
  mdiChevronUp,
  mdiContentCopy,
  mdiDelete,
  mdiEye,
  mdiEyeOff,
  mdiFolderMove,
  mdiTuneVertical,
} from "@mdi/js";
import Icon from "@mdi/react";
import Button from "@/components/admin/_components/Button";
import CardBox from "@/components/admin/_components/CardBox";
import type { PageSection, PageSectionSlotType, SectionType } from "@/types/page-section";
import { getAllowedBuilderPageOptions, type PageBuilderKey } from "@/lib/content/page-section-page-rules";
import { PAGE_LABELS, PLACEMENT_LABELS, SECTION_TYPE_LABELS } from "@/lib/content/constants";
import {
  buildPageLayoutSectionPayload,
  PAGE_SECTION_SLOT_LABELS,
  type PageLayoutAddTemplate,
} from "@/lib/content/page-layout-admin";
import {
  hasCommunityPostListSlot,
  hasTournamentsTournamentListSlot,
} from "@/lib/content/page-layout-legacy-readiness";
import { isHomeStructureSlotType } from "@/lib/home-structure-slots";
import { SectionEditor } from "@/components/admin/page-builder/SectionEditor";
import { PageBuilderMobilePreview } from "@/components/admin/page-builder/PageBuilderMobilePreview";
import {
  SectionRowTools,
  type SectionToolMode,
} from "@/components/admin/page-builder/SectionRowTools";
const BUILDER_PAGES: PageBuilderKey[] = ["home", "community", "tournaments"];

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
  return `${placement} · 빌더 목록 ${index + 1}번째 · DB sortOrder ${s.sortOrder}${period}`;
}

export function PageBuilderClient() {
  const [page, setPage] = useState<PageBuilderKey>("home");
  const [rows, setRows] = useState<PageSection[]>([]);
  const rowsRef = useRef<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addValue, setAddValue] = useState<AddOptionValue>("cms:text");
  const [activeTool, setActiveTool] = useState<{ id: string; mode: SectionToolMode } | null>(null);
  /** 홈 구조 슬롯 스타일·CTA 미리보기용 `sectionStyleJson` 누적 (패널을 닫거나 다른 행을 열면 초기화) */
  const [slotSectionStyleDraft, setSlotSectionStyleDraft] = useState<Record<string, string>>({});

  const handleSlotSectionStyleDraft = useCallback((id: string, json: string) => {
    setSlotSectionStyleDraft((prev) => (prev[id] === json ? prev : { ...prev, [id]: json }));
  }, []);

  const closeBuilderTool = useCallback(() => {
    setSlotSectionStyleDraft({});
    setActiveTool(null);
  }, []);

  const openTool = (id: string, mode: SectionToolMode) => {
    setActiveTool((prev) => {
      if (prev?.id === id && prev?.mode === mode) {
        setSlotSectionStyleDraft({});
        return null;
      }
      setSlotSectionStyleDraft({});
      return { id, mode };
    });
  };

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setError("네트워크 오류입니다.");
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
      throw new Error(typeof d.error === "string" ? d.error : "순서 저장에 실패했습니다.");
    }
  }, [page]);

  const handleReorderCommit = useCallback(
    async (next: PageSection[]) => {
      const prevSnapshot = rowsRef.current;
      rowsRef.current = next;
      setRows(next);
      setBusyId("reorder");
      try {
        await persistOrder(next);
      } catch (e) {
        rowsRef.current = prevSnapshot;
        setRows(prevSnapshot);
        alert(e instanceof Error ? e.message : "순서 저장에 실패했습니다.");
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
        alert(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === s.id ? (data as PageSection) : r)));
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
        alert(typeof data?.error === "string" ? data.error : "삭제 처리에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? (data as PageSection) : r)));
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
        alert(typeof data?.error === "string" ? data.error : "복원에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? (data as PageSection) : r)));
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
        alert(typeof data?.error === "string" ? data.error : "추가에 실패했습니다.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const reorderDisabled = busyId !== null;

  const legacyFallbackRemovable = useMemo(() => {
    if (page === "community") return hasCommunityPostListSlot(rows);
    if (page === "tournaments") return hasTournamentsTournamentListSlot(rows);
    return null;
  }, [page, rows]);

  const previewRows = useMemo(() => {
    return rows.map((r) => {
      const d = slotSectionStyleDraft[r.id];
      if (d === undefined) return r;
      return { ...r, sectionStyleJson: d };
    });
  }, [rows, slotSectionStyleDraft]);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,400px)] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-slate-400">페이지</span>
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
        </div>

        <p className="text-sm text-gray-600 dark:text-slate-400">
          드래그 또는 위/아래 버튼으로 순서를 저장합니다. <strong>히어로 슬롯</strong>은 이 화면에서 배치·노출만 다루며, 문구·이미지·버튼은「
          <strong>히어로 설정</strong>」에서만 편집합니다. <strong>대회 안내·당구장 소개·당구장 링크·난구 진입</strong> 홈 구조 블록은 목록에서
          표시·순서·숨김·삭제(소프트)·복제를 조작할 수 있으며, 본문 데이터는 홈에서 기존과 동일하게 연동됩니다. CMS 블록(텍스트·이미지·CTA)은「
          <strong>CMS 편집으로 이동</strong>」으로 콘텐츠를 고칩니다.
        </p>

        {!loading && legacyFallbackRemovable === false && page === "community" ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>레거시 준비:</strong> 공개 커뮤니티 허브는 아직「게시글 목록」슬롯(<code className="text-[11px]">postList</code>
            )이 없으면 예전 전체 목록 UI로 폴백합니다. 폴백을 끄려면 이 페이지에 해당 슬롯을 추가·노출하세요.
          </p>
        ) : null}
        {!loading && legacyFallbackRemovable === true && page === "community" ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <strong>레거시 준비:</strong> <code className="text-[11px]">postList</code> 슬롯이 있어, 코드에서 커뮤니티 목록 폴백
            분기를 제거할 수 있는 상태입니다(실제 제거는 별도 배포).
          </p>
        ) : null}
        {!loading && legacyFallbackRemovable === false && page === "tournaments" ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>레거시 준비:</strong>「대회 목록」슬롯(<code className="text-[11px]">tournamentList</code>)이 없으면 공개
            페이지는 예전 목록 블록으로 폴백합니다. 슬롯을 추가·노출하면 단일 경로로 맞출 수 있습니다.
          </p>
        ) : null}
        {!loading && legacyFallbackRemovable === true && page === "tournaments" ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <strong>레거시 준비:</strong> <code className="text-[11px]">tournamentList</code> 슬롯이 있어, 대회 목록 폴백 분기
            제거를 검토할 수 있습니다(실제 제거는 별도 배포).
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <CardBox>
          {loading ? (
            <p className="text-gray-500">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-500">이 페이지에 등록된 섹션이 없습니다. 아래에서 추가할 수 있습니다.</p>
          ) : (
            <SectionEditor
              sections={rows}
              reorderDisabled={reorderDisabled}
              rowLabel={rowLabel}
              metaLine={metaLine}
              onReorderCommit={handleReorderCommit}
              renderStatusBadges={(s, i) => (
                <>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                    {s.slotType
                      ? (PAGE_SECTION_SLOT_LABELS[s.slotType] ?? s.slotType)
                      : SECTION_TYPE_LABELS[s.type]}
                  </span>
                  <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:border-slate-600 dark:text-slate-300">
                    순서 {i + 1}
                  </span>
                  {s.deletedAt ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-900 dark:bg-red-950/50 dark:text-red-200">
                      삭제됨(복원 가능)
                    </span>
                  ) : s.isVisible ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      표시 중
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      숨김
                    </span>
                  )}
                </>
              )}
              renderRowBelow={(s) =>
                activeTool?.id === s.id ? (
                  <SectionRowTools
                    key={`${activeTool.id}-${activeTool.mode}`}
                    mode={activeTool.mode}
                    section={s}
                    currentPage={page}
                    slotSectionStyleMergeBase={slotSectionStyleDraft[s.id] ?? s.sectionStyleJson}
                    onSlotSectionStyleDraft={(json) => handleSlotSectionStyleDraft(s.id, json)}
                    onClose={closeBuilderTool}
                    onStructureSaved={(u) =>
                      setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)))
                    }
                    onMovedAway={() => void load()}
                    onDuplicated={(target, sameList) => {
                      if (sameList) void load();
                      else
                        alert(
                          `「${PAGE_LABELS[target]}」페이지 끝에 복제되었습니다. 상단에서 해당 페이지를 고른 뒤 순서를 조정할 수 있습니다.`
                        );
                    }}
                    setBusy={setBusyId}
                  />
                ) : null
              }
              renderRowActions={(s, i) => (
                <>
                  <button
                    type="button"
                    title="위로"
                    disabled={i === 0 || reorderDisabled}
                    className="rounded border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => void move(i, -1)}
                  >
                    <Icon path={mdiChevronUp} size={0.9} />
                  </button>
                  <button
                    type="button"
                    title="아래로"
                    disabled={i === rows.length - 1 || reorderDisabled}
                    className="rounded border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => void move(i, 1)}
                  >
                    <Icon path={mdiChevronDown} size={0.9} />
                  </button>
                  <button
                    type="button"
                    title={s.deletedAt ? "삭제된 블록은 복원 후 표시를 바꿀 수 있습니다." : s.isVisible ? "숨기기" : "표시"}
                    disabled={reorderDisabled || Boolean(s.deletedAt)}
                    className="rounded border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => void toggleVisible(s)}
                  >
                    <Icon path={s.isVisible ? mdiEyeOff : mdiEye} size={0.9} />
                  </button>
                  <button
                    type="button"
                    title={
                      isHomeStructureSlotType(s.slotType)
                        ? "이 영역 꾸미기 (레이아웃·카드·클릭·노출)"
                        : "블록 설정 (노출 위치·기간)"
                    }
                    disabled={reorderDisabled}
                    className={`rounded border p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
                      activeTool?.id === s.id && activeTool.mode === "structure"
                        ? "border-site-primary bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                        : "border-gray-300 dark:border-slate-600"
                    }`}
                    onClick={() => openTool(s.id, "structure")}
                  >
                    <Icon path={mdiTuneVertical} size={0.9} />
                  </button>
                  <button
                    type="button"
                    title="다른 페이지로 이동"
                    disabled={reorderDisabled}
                    className={`rounded border p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
                      activeTool?.id === s.id && activeTool.mode === "move"
                        ? "border-site-primary bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                        : "border-gray-300 dark:border-slate-600"
                    }`}
                    onClick={() => openTool(s.id, "move")}
                  >
                    <Icon path={mdiFolderMove} size={0.9} />
                  </button>
                  <button
                    type="button"
                    title="복제"
                    disabled={reorderDisabled}
                    className={`rounded border p-1.5 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
                      activeTool?.id === s.id && activeTool.mode === "duplicate"
                        ? "border-site-primary bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                        : "border-gray-300 dark:border-slate-600"
                    }`}
                    onClick={() => openTool(s.id, "duplicate")}
                  >
                    <Icon path={mdiContentCopy} size={0.9} />
                  </button>
                  {s.slotType === "hero" ? (
                    <Button href="/admin/site/hero" label="히어로 설정" color="info" small />
                  ) : isHomeStructureSlotType(s.slotType) ? null : s.slotType ? (
                    <Button href="/admin/page-sections" label="CMS 편집으로 이동" color="info" small />
                  ) : (
                    <Button href={`/admin/page-sections/${s.id}/edit`} label="CMS 편집으로 이동" color="info" small />
                  )}
                  {s.deletedAt ? (
                    <button
                      type="button"
                      title="복원"
                      disabled={reorderDisabled}
                      className="rounded border border-emerald-300 p-1.5 text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                      onClick={() => void restore(s.id)}
                    >
                      <Icon path={mdiBackupRestore} size={0.9} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="삭제 (소프트)"
                      disabled={reorderDisabled}
                      className="rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={() => void softRemove(s.id)}
                    >
                      <Icon path={mdiDelete} size={0.9} />
                    </button>
                  )}
                </>
              )}
            />
          )}
        </CardBox>

        <CardBox>
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-slate-200">섹션 추가</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-slate-400">유형</span>
              <select
                className="min-w-[14rem] rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value as AddOptionValue)}
              >
                <optgroup label="CMS 블록">
                  <option value="cms:text">텍스트</option>
                  <option value="cms:image">이미지</option>
                  <option value="cms:cta">CTA</option>
                </optgroup>
                <optgroup label="구조 슬롯">
                  {SLOT_TYPES.filter((st) =>
                    getAllowedBuilderPageOptions(st, "text").includes(page)
                  ).map((st) => (
                    <option key={st} value={`slot:${st}`}>
                      {PAGE_SECTION_SLOT_LABELS[st]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <Button
              label="추가"
              color="info"
              small
              disabled={loading || reorderDisabled}
              onClick={() => void addSection()}
            />
          </div>
        </CardBox>
      </div>
      <div className="mt-6 min-w-0 lg:mt-0">
        <PageBuilderMobilePreview page={page} rows={loading ? [] : previewRows} />
      </div>
    </div>
  );
}
