"use client";

import { useState } from "react";
import type { PageSection } from "@/types/page-section";
import type { PlacementSlug } from "@/types/page-section";
import type { PageSlug } from "@/types/page-section";
import { SectionPositionPreview } from "./SectionPositionPreview";
import { mdiClose } from "@mdi/js";
import Icon from "@/components/admin/_components/Icon";

type Props = {
  placement: PlacementSlug;
  page: PageSlug;
  sortOrder: number;
  currentSectionId: string;
  sections: PageSection[];
  onPlacementChange?: (placement: PlacementSlug) => void;
};

/** 1024px 이상: sticky 패널, 미만: 미리보기 버튼 + 모달 */
export function SectionPositionPreviewPanel(props: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* PC (1024px+): 오른쪽에 항상 표시되는 sticky 패널 */}
      <div className="hidden lg:block lg:w-[280px] lg:shrink-0 lg:sticky lg:top-6">
        <div className="rounded-xl border border-site-border bg-site-card shadow-lg p-4">
          <h3 className="text-sm font-semibold text-site-text dark:text-slate-200 mb-3">
            페이지 구조 미리보기
          </h3>
          <SectionPositionPreview
            {...props}
            className="min-w-0"
          />
        </div>
      </div>

      {/* 모바일: 고정 플로팅 버튼 */}
      <div className="fixed bottom-6 right-4 z-40 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-full bg-site-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:opacity-90"
          aria-label="미리보기 보기"
        >
          미리보기 보기
        </button>
      </div>

      {/* 모바일: 하단 슬라이드업 시트 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-labelledby="preview-sheet-title"
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
            aria-label="닫기"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-site-border bg-site-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-site-border bg-site-card px-4 py-3">
              <h2 id="preview-sheet-title" className="text-base font-semibold text-site-text">
                페이지 구조 미리보기
              </h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-site-primary"
                aria-label="닫기"
              >
                <Icon path={mdiClose} size={22} />
              </button>
            </div>
            <div className="p-4 pb-8">
              <SectionPositionPreview
                {...props}
                className="min-w-0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
