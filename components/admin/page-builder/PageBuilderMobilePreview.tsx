"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { PageSection } from "@/types/page-section";
import type { PageSlotRenderContext } from "@/types/page-slot-render-context";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import {
  applyPublicHeroSingleCanonical,
  filterPageBlocksForPublicView,
} from "@/lib/content/filter-page-blocks-public-view";
import { PageRenderer } from "@/components/content/PageRenderer";
import CardBox from "@/components/admin/_components/CardBox";

type Props = {
  /** 현재 빌더에서 편집 중인 페이지(슬롯 미리보기 컨텍스트와 일치) */
  page: PageBuilderKey;
  /** 페이지 빌더 목록(현재 편집 순서). 변경 시 즉시 미리보기 반영 */
  rows: PageSection[];
  /** 표시 모드: mobile(폰 프레임) / page(작업공간 폭) */
  variant?: "mobile" | "page";
  /** 선택 블록 id 표시용 */
  selectedBlockId?: string | null;
  /** 선택 시 자동 스크롤 여부 (기본: true) */
  autoScrollOnSelect?: boolean;
  /** 상단 제목 표시 여부 (기본: true) */
  showTitle?: boolean;
  onSelectBlock?: (id: string) => void;
};

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err && typeof err === "object" && "type" in err) {
    const eventType = String((err as { type?: unknown }).type ?? "unknown");
    return new Error(`${fallback} (event: ${eventType})`);
  }
  return new Error(fallback);
}

/**
 * 관리자 전용: 좁은 뷰포트에서 공개와 동일 `PageRenderer` + 슬롯 컨텍스트로 스택 확인.
 */
export function PageBuilderMobilePreview({
  page,
  rows,
  variant = "mobile",
  selectedBlockId = null,
  autoScrollOnSelect = true,
  showTitle = true,
  onSelectBlock,
}: Props) {
  const blocks = useMemo(
    () => applyPublicHeroSingleCanonical(page, filterPageBlocksForPublicView(rows)),
    [page, rows]
  );
  const [slotContext, setSlotContext] = useState<PageSlotRenderContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCtxError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/content/page-preview-context?page=${encodeURIComponent(page)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("[PageBuilderMobilePreview] context API failed", {
            page,
            status: res.status,
            statusText: res.statusText,
            response: data,
          });
          if (!cancelled) {
            setSlotContext(null);
            setCtxError(typeof data?.error === "string" ? data.error : "미리보기 데이터를 불러오지 못했습니다.");
          }
          return;
        }
        if (!cancelled) {
          setSlotContext(data as PageSlotRenderContext);
          setCtxError(null);
        }
      } catch (err) {
        const error = toError(err, "미리보기 컨텍스트를 불러오지 못했습니다.");
        console.error("[PageBuilderMobilePreview] context fetch failed", { page, error, original: err });
        if (!cancelled) {
          setSlotContext(null);
          setCtxError(error.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const emptyHint =
    blocks.length === 0 ? (
      <p className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">
        표시 중인 블록이 없습니다.
        <br />
        <span className="text-xs">숨김이거나 기간 밖이면 여기에 나오지 않습니다.</span>
      </p>
    ) : null;

  const isPageVariant = variant === "page";
  const MOBILE_RENDER_WIDTH_PX = 375;
  const MOBILE_RENDER_HEIGHT_PX = Math.round((MOBILE_RENDER_WIDTH_PX * 16) / 9); // 375 * 16 / 9 = 667
  const MOBILE_FRAME_BORDER_PX = 10;
  const MOBILE_FRAME_WIDTH_PX = 280;
  const MOBILE_VIEWPORT_WIDTH_PX = MOBILE_FRAME_WIDTH_PX - MOBILE_FRAME_BORDER_PX * 2;
  const MOBILE_PREVIEW_SCALE = MOBILE_VIEWPORT_WIDTH_PX / MOBILE_RENDER_WIDTH_PX;
  const MOBILE_VIEWPORT_HEIGHT_PX = Math.round(MOBILE_RENDER_HEIGHT_PX * MOBILE_PREVIEW_SCALE);
  const viewportId = `preview-viewport-${page}`;

  const preventPreviewNavigation = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest("a");
    if (anchor) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (!autoScrollOnSelect) return;
    if (!selectedBlockId) return;
    const viewport = document.getElementById(viewportId);
    if (!viewport) return;
    const target = viewport.querySelector(`[data-block-id="${selectedBlockId}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [autoScrollOnSelect, selectedBlockId, viewportId, blocks.length]);

  return (
    <CardBox className={isPageVariant ? undefined : "lg:sticky lg:top-4"}>
      {showTitle ? (
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">모바일 미리보기</h3>
      ) : null}
      {ctxError ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {ctxError} (슬롯은 자리 표시만 될 수 있습니다.)
        </p>
      ) : null}
      <div className={`mt-3 ${isPageVariant ? "" : "flex justify-center"}`}>
        <div
          className={
            isPageVariant
              ? "w-full rounded border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
              : "relative shrink-0 rounded-[2rem] border-[10px] border-gray-800 bg-gray-800 shadow-xl dark:border-slate-950 dark:bg-slate-950"
          }
          style={isPageVariant ? undefined : { width: `${MOBILE_FRAME_WIDTH_PX}px` }}
          aria-label={isPageVariant ? "페이지 미리보기 프레임" : "모바일 미리보기 프레임"}
        >
          {!isPageVariant ? (
            <div className="mx-auto mb-1 mt-2 h-5 w-24 shrink-0 rounded-full bg-gray-700 dark:bg-slate-800" aria-hidden />
          ) : null}
          <div
            id={viewportId}
            className={
              isPageVariant
                ? "max-h-[min(80vh,980px)] min-h-[300px] overflow-y-auto overflow-x-hidden rounded bg-site-bg text-site-text [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "mb-1 overflow-y-auto overflow-x-hidden rounded-2xl bg-site-bg text-site-text [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            }
            style={
              isPageVariant
                ? { WebkitOverflowScrolling: "touch" }
                : {
                    WebkitOverflowScrolling: "touch",
                    width: `${MOBILE_VIEWPORT_WIDTH_PX}px`,
                    minWidth: `${MOBILE_VIEWPORT_WIDTH_PX}px`,
                    maxWidth: `${MOBILE_VIEWPORT_WIDTH_PX}px`,
                    height: `${MOBILE_VIEWPORT_HEIGHT_PX}px`,
                  }
            }
          >
            {emptyHint ?? (
              <div
                className="min-w-0"
                style={
                  isPageVariant
                    ? undefined
                    : {
                        width: `${MOBILE_RENDER_WIDTH_PX}px`,
                        zoom: MOBILE_PREVIEW_SCALE,
                      }
                }
                onClickCapture={preventPreviewNavigation}
              >
                <PageRenderer
                  blocks={blocks}
                  slotContext={slotContext ?? { page }}
                  slotSurface="adminPreview"
                  selectedBlockId={selectedBlockId}
                  onBlockClick={onSelectBlock}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </CardBox>
  );
}
