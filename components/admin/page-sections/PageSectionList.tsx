"use client";

import type { PageSection } from "@/types/page-section";
import type { HeroSettings } from "@/lib/hero-settings";
import { PAGE_LABELS, PLACEMENT_LABELS, SECTION_TYPE_LABELS } from "@/lib/content/constants";
import Button from "@/components/admin/_components/Button";
import { isLegacyHomeHeroCmsBlock } from "@/lib/content/filter-page-blocks-public-view";
import { resolvePageSectionListThumbnailSrc } from "@/lib/content/page-section-list-thumbnail";
import { IMAGE_PLACEHOLDER_SRC } from "@/lib/image-src";

type Props = {
  sections: PageSection[];
  /** 공개 히어로와 동일 JSON 정본 — 썸네일(히어로 슬롯·레거시 메인 비주얼)에 사용 */
  heroSettings: HeroSettings | null;
  pageFilter: string;
  placementFilter: string;
  onPageFilterChange: (v: string) => void;
  onPlacementFilterChange: (v: string) => void;
};

/**
 * CMS 블록 목록·필터·내용 편집 진입만 담당.
 * 순서·노출·위치는 `페이지 빌더`에서만 변경합니다.
 */
export function PageSectionList({
  sections,
  heroSettings,
  pageFilter,
  placementFilter,
  onPageFilterChange,
  onPlacementFilterChange,
}: Props) {
  const filtered = sections.filter((s) => {
    if (pageFilter && s.page !== pageFilter) return false;
    if (placementFilter && s.placement !== placementFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        슬롯·순서·노출은{" "}
        <Button href="/admin/page-builder" label="페이지 빌더 (구조)" color="info" small className="align-middle" />{" "}
        전용입니다. 아래 <strong>내용 편집</strong>은 CMS 블록만 해당합니다.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={pageFilter}
          onChange={(e) => onPageFilterChange(e.target.value)}
          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
        >
          <option value="">전체 페이지</option>
          {(Object.entries(PAGE_LABELS) as [keyof typeof PAGE_LABELS, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={placementFilter}
          onChange={(e) => onPlacementFilterChange(e.target.value)}
          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
        >
          <option value="">전체 위치</option>
          {(Object.entries(PLACEMENT_LABELS) as [keyof typeof PLACEMENT_LABELS, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-site-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-site-border bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="p-3 font-medium">썸네일</th>
              <th className="p-3 font-medium">섹션 제목</th>
              <th className="p-3 font-medium">유형</th>
              <th className="p-3 font-medium">슬롯</th>
              <th className="p-3 font-medium">노출 페이지</th>
              <th className="p-3 font-medium">노출 위치</th>
              <th className="p-3 font-medium">링크</th>
              <th className="p-3 font-medium">동작</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  조건에 맞는 섹션이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const thumbSrc = resolvePageSectionListThumbnailSrc(s, heroSettings);
                const isPlaceholderThumb = thumbSrc === IMAGE_PLACEHOLDER_SRC;
                return (
                <tr
                  key={s.id}
                  className="border-b border-site-border hover:bg-gray-50 dark:hover:bg-slate-800/50"
                >
                  <td className="p-3">
                    {thumbSrc ? (
                      <div
                        className={`h-12 w-20 overflow-hidden rounded bg-gray-100 ${isPlaceholderThumb ? "opacity-70" : ""}`}
                        title={isPlaceholderThumb ? "이미지 없음(공개와 동일 자리 표시)" : undefined}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{s.title || "—"}</td>
                  <td className="p-3">{SECTION_TYPE_LABELS[s.type]}</td>
                  <td className="p-3 text-xs text-gray-600 dark:text-slate-400">{s.slotType ?? "—"}</td>
                  <td className="p-3">{PAGE_LABELS[s.page]}</td>
                  <td className="p-3">
                    {PLACEMENT_LABELS[s.placement]}
                    {s.placement === "main_visual_bg" && s.type === "image" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        레거시 히어로 배경
                      </span>
                    )}
                  </td>
                  <td className="p-3">{s.linkType !== "none" ? "있음" : "—"}</td>
                  <td className="p-3">
                    {s.slotType ? (
                      <Button href="/admin/page-builder" label="페이지 빌더" color="contrast" small />
                    ) : isLegacyHomeHeroCmsBlock(s) ? (
                      <Button href="/admin/site/settings" label="헤더/푸터/인트로 관리" color="info" small />
                    ) : (
                      <Button href={`/admin/page-sections/${s.id}/edit`} label="내용 편집" color="info" small />
                    )}
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
