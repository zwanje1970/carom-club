"use client";

import { useEffect, useMemo, useState } from "react";
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
};

/**
 * 관리자 전용: 좁은 뷰포트에서 공개와 동일 `PageRenderer` + 슬롯 컨텍스트로 스택 확인.
 */
export function PageBuilderMobilePreview({ page, rows }: Props) {
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
      } catch {
        if (!cancelled) {
          setSlotContext(null);
          setCtxError("네트워크 오류로 미리보기를 불러오지 못했습니다.");
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

  return (
    <CardBox className="lg:sticky lg:top-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">모바일 미리보기</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        공개와 동일한 <code className="rounded bg-gray-100 px-1 dark:bg-slate-800">PageRenderer</code>로 스택을 보여
        줍니다. 순서·표시·기간 변경이 바로 반영되며, 홈 구조 슬롯의 스타일·CTA 탭 편집 중에는 저장 전에도 여기에 미리
        반영됩니다.
      </p>
      <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200">
        <strong>미리보기 한계:</strong> 커뮤니티 게시글 목록은 항상「전체」탭 기준이며, 실제 사이트의 게시판·카테고리 URL과 다를 수
        있습니다. 대회 목록은 기본 필터(쿼리 없음) 기준이며, 실제 페이지의 탭·정렬·필터와 다를 수 있습니다. 연결되지 않은 슬롯은
        여기서만 점선 안내가 보이고, 운영 사이트에서는 해당 자리에 아무것도 나오지 않습니다.
      </p>
      {ctxError ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {ctxError} (슬롯은 자리 표시만 될 수 있습니다.)
        </p>
      ) : null}
      <div className="mt-3 flex justify-center">
        <div
          className="relative w-full max-w-[390px] rounded-[2rem] border-[10px] border-gray-800 bg-gray-800 shadow-xl dark:border-slate-950 dark:bg-slate-950"
          aria-label="모바일 미리보기 프레임"
        >
          <div className="mx-auto mb-1 mt-2 h-5 w-24 shrink-0 rounded-full bg-gray-700 dark:bg-slate-800" aria-hidden />
          <div
            className="mx-1 mb-1 max-h-[min(75vh,820px)] min-h-[200px] overflow-y-auto overflow-x-hidden rounded-2xl bg-site-bg text-site-text"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {emptyHint ?? (
              <div className="min-w-0">
                <PageRenderer
                  blocks={blocks}
                  slotContext={slotContext ?? { page }}
                  slotSurface="adminPreview"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </CardBox>
  );
}
