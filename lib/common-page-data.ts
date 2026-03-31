/**
 * 공개 페이지 공통 데이터: copy, siteSettings, noticeBars, popups, pageSections
 * unstable_cache로 60초 재검증. 페이지 이동 시 동일 데이터 재요청 시 캐시에서 반환.
 */

import { unstable_cache } from "next/cache";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getSiteSettings } from "@/lib/site-settings";
import {
  getNoticeBarsForPage,
  getOrderedPageBlocksForPage,
  getPopupsForPage,
  getPageSectionsForPage,
} from "@/lib/content/service";
import type { SiteSettings } from "@/lib/site-settings";
import type { PageSection } from "@/types/page-section";
import type { Popup } from "@/types/popup";
import type { NoticeBar } from "@/types/notice-bar";

export type PageSlug = "home" | "tournaments" | "venues" | "community";

export type CommonPageData = {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
  noticeBars: NoticeBar[];
  popups: Popup[];
  /** CMS만 (`slotType` 없음). 레거시·일부 화면용 */
  pageSections: PageSection[];
  /** CMS+슬롯 정렬 스택. `PageRenderer`·미리보기와 동일 소스 */
  pageBlocks: PageSection[];
};

const REVALIDATE_SECONDS = 60;

async function getCommonPageDataUncached(page: PageSlug): Promise<CommonPageData> {
  const [{ copy, siteSettings }, noticeBars, popups, pageSections, pageBlocks] = await Promise.all([
    getCommonGlobalData(),
    getNoticeBarsForPage(page),
    getPopupsForPage(page),
    getPageSectionsForPage(page),
    getOrderedPageBlocksForPage(page),
  ]);
  return {
    copy,
    siteSettings,
    noticeBars,
    popups,
    pageSections,
    pageBlocks,
  };
}

/**
 * 페이지별 공통 데이터 한 번에 조회. 60초 캐시로 동일 페이지/다른 페이지 이동 시 재사용.
 */
export function getCommonPageData(page: PageSlug): Promise<CommonPageData> {
  return unstable_cache(
    () => getCommonPageDataUncached(page),
    [`common-page-data`, page],
    { revalidate: REVALIDATE_SECONDS, tags: ["common-page-data"] }
  )();
}

/**
 * copy + siteSettings 만 필요할 때 (레이아웃 등). 60초 캐시.
 */
export async function getCommonGlobalData(): Promise<{
  copy: Record<string, string>;
  siteSettings: SiteSettings;
}> {
  return unstable_cache(
    async () => {
      const [copy, siteSettings] = await Promise.all([
        getAdminCopy(),
        getSiteSettings(),
      ]);
      return { copy, siteSettings };
    },
    ["common-global-data"],
    { revalidate: REVALIDATE_SECONDS, tags: ["common-page-data"] }
  )();
}
