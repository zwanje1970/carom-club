"use client";

import type { PageSection, PageSlug } from "@/types/page-section";
import type { SectionToolMode } from "@/components/admin/page-builder/SectionRowTools";
import { SectionRowTools } from "@/components/admin/page-builder/SectionRowTools";
import { HomeContentQuickEditor } from "@/components/admin/page-builder/HomeContentQuickEditor";
import { isHomeStructureSlotType } from "@/lib/home-structure-slots";

type Props = {
  section: PageSection;
  currentPage: PageSlug;
  slotSectionStyleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (json: string) => void;
  onContentDraftChange?: (draft: PageSection) => void;
  onClose: () => void;
  onStructureSaved: (updated: PageSection) => void;
  setBusy: (id: string | null) => void;
};

/**
 * 홈 블록 편집 통합 패널.
 * 모든 블록이 동일한 "편집" 버튼으로 진입하고, 제한 항목은 패널에서 안내한다.
 */
export function HomeBlockEditorPanel({
  section,
  currentPage,
  slotSectionStyleMergeBase,
  onSlotSectionStyleDraft,
  onContentDraftChange,
  onClose,
  onStructureSaved,
  setBusy,
}: Props) {
  const isStructureBlock = Boolean(section.slotType);
  const isHomeDecorateBlock = isHomeStructureSlotType(section.slotType);

  return (
    <div className="space-y-3 rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
      <div className="font-medium text-gray-800 dark:text-slate-200">상단: 블록 영역</div>

      <section className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">1) 미리보기</p>
        <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          제목: {section.title?.trim() || "(비어 있음)"} · 설명:{" "}
          {section.description?.trim() ? "입력됨" : "비어 있음"} · 이미지:{" "}
          {section.imageUrl?.trim() ? "입력됨" : "비어 있음"}
        </p>
      </section>

      <section className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">
          2) 레이아웃 / 3) 배경 / 4) 테두리 / 7) 카드 ON/OFF
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          모든 블록에서 동일하게 진입합니다. 블록 종류에 따라 일부 항목만 조정 가능한 경우, 이 패널에서 안내합니다.
        </p>
        <div className="mt-2">
          <SectionRowTools
            key={`${section.id}-structure`}
            mode={"structure" as SectionToolMode}
            section={section}
            currentPage={currentPage}
            slotSectionStyleMergeBase={slotSectionStyleMergeBase}
            onSlotSectionStyleDraft={onSlotSectionStyleDraft}
            onClose={onClose}
            onStructureSaved={onStructureSaved}
            onMovedAway={() => {}}
            onDuplicated={() => {}}
            setBusy={setBusy}
          />
        </div>
        {!isHomeDecorateBlock ? (
          <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
            이 블록은 현재 형식/레이아웃/디자인 항목 일부만 적용됩니다. 적용되지 않는 항목은 저장 시 기존 값을 유지합니다.
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
            카드 ON 시 카드 설정 영역이 자동으로 확장됩니다.
          </p>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">5) 내용 / 6) 링크·버튼</p>
        {isStructureBlock ? (
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
            이 블록은 페이지 구조 중심 블록입니다. 내용·버튼 편집은 해당 전용 화면 또는 구조 편집 항목에서 지원됩니다.
          </p>
        ) : (
          <div className="mt-2">
            <HomeContentQuickEditor
              section={section}
              setBusy={setBusy}
              onSaved={onStructureSaved}
              onDraftChange={onContentDraftChange}
              onClose={onClose}
            />
          </div>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">하단: 카드 영역</p>
        {isHomeDecorateBlock ? (
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
            카드 사용 ON일 때 자동/수동 중 하나만 선택해 카드 영역을 구성합니다(혼합 불가).
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
            이 블록은 카드 영역을 사용하지 않습니다. 카드 관련 항목은 설명만 표시되고 데이터는 변경되지 않습니다.
          </p>
        )}
      </section>
    </div>
  );
}
