/**
 * CMS 콘텐츠 서비스
 * - DATABASE_URL 있으면: Prisma DB 사용 (수정 내용 메인에 반영)
 * - 없으면: mock 데이터 사용
 */

import { randomUUID } from "crypto";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { mockPageSections } from "./mock-data";
import {
  deleteMockPageSectionFromStore,
  getMockPageSectionsAll,
  reorderMockPageSectionOnPage,
  restoreMockPageSection,
  softDeleteMockPageSection,
  upsertMockPageSection,
} from "./mock-page-sections-store";
import { mockPopups } from "./mock-data";
import { mockNoticeBars } from "./mock-data";
import * as db from "./db-content";
import {
  PAGE_BUILDER_KEYS,
  type PageBuilderKey,
  isSectionAllowedOnPage,
} from "./page-section-page-rules";
import type { PageSection, PageSlug, PlacementSlug } from "@/types/page-section";
import type { Popup } from "@/types/popup";
import type { NoticeBar } from "@/types/notice-bar";
import type { PopupPageSlug } from "@/types/popup";
import type { NoticeBarPageSlug } from "@/types/notice-bar";

const now = () => new Date().toISOString();

function isInRange(startAt: string | null, endAt: string | null): boolean {
  const t = Date.now();
  if (startAt && new Date(startAt).getTime() > t) return false;
  if (endAt && new Date(endAt).getTime() < t) return false;
  return true;
}

/** DB 조회 실패 시(테이블 없음 등) mock 반환하여 500 방지 */
async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn("[content/service] DB fallback to mock:", (e as Error)?.message ?? e);
    return fallback;
  }
}

/** 페이지별 노출 중인 **CMS** 섹션 (`slotType` 없음). `PageSectionsRenderer`용. */
export async function getPageSectionsForPage(page: PageSlug): Promise<PageSection[]> {
  const fallback = mockPageSections
    .filter(
      (s) =>
        s.page === page &&
        s.isVisible &&
        !s.slotType &&
        !s.deletedAt &&
        isInRange(s.startAt, s.endAt)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) {
    const all = getMockPageSectionsAll();
    return all
      .filter(
        (s) =>
          s.page === page &&
          s.isVisible &&
          !s.slotType &&
          !s.deletedAt &&
          isInRange(s.startAt, s.endAt)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const result = await withFallback(() => db.getPageSectionsForPageFromDb(page), fallback);
  return result.length > 0 ? result : fallback;
}

/** `page` 기준 구조 슬롯 행만 (`slotType` 있음). 1차는 조회 API만 — 라우트 미연결. */
export async function getPageLayoutSlotsForPage(page: PageSlug): Promise<PageSection[]> {
  if (!isDatabaseConfigured()) return [];
  return withFallback(() => db.getPageLayoutSlotsForPageFromDb(page), []);
}

/** CMS+슬롯 한 덩어리 정렬 목록(관리·미리보기·공개 PageRenderer). */
export async function getOrderedPageBlocksForPage(page: PageSlug): Promise<PageSection[]> {
  const fallback = mockPageSections
    .filter((s) => s.page === page && s.isVisible && !s.deletedAt && isInRange(s.startAt, s.endAt))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) {
    const all = getMockPageSectionsAll();
    return all
      .filter((s) => s.page === page && s.isVisible && !s.deletedAt && isInRange(s.startAt, s.endAt))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return withFallback(() => db.getOrderedPageBlocksForPageFromDb(page), fallback);
}

/** 페이지별 노출 중인 팝업. DB 비어 있으면 mock으로 동일 화면 유지 */
export async function getPopupsForPage(page: PopupPageSlug): Promise<Popup[]> {
  const mock = mockPopups
    .filter(
      (p) =>
        (p.page === "all" || p.page === page) &&
        p.isVisible &&
        isInRange(p.startAt, p.endAt)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  const result = await withFallback(() => db.getPopupsForPageFromDb(page), mock);
  return result.length > 0 ? result : mock;
}

/** 페이지별 노출 중인 공지 배너. DB 비어 있으면 mock으로 동일 화면 유지 */
export async function getNoticeBarsForPage(page: NoticeBarPageSlug): Promise<NoticeBar[]> {
  const mock = mockNoticeBars
    .filter(
      (n) =>
        (n.page === "all" || n.page === page) &&
        n.isVisible &&
        isInRange(n.startAt, n.endAt)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  const result = await withFallback(() => db.getNoticeBarsForPageFromDb(page), mock);
  return result.length > 0 ? result : mock;
}

// ---------- 관리자용: 전체 목록 ----------

export async function getAllPageSections(): Promise<PageSection[]> {
  const mock = [...mockPageSections].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getAllPageSectionsFromDb(), mock);
}

export async function getAllPopups(): Promise<Popup[]> {
  const mock = [...mockPopups].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getAllPopupsFromDb(), mock);
}

export async function getAllNoticeBars(): Promise<NoticeBar[]> {
  const mock = [...mockNoticeBars].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getAllNoticeBarsFromDb(), mock);
}

export async function getPageSectionById(id: string): Promise<PageSection | null> {
  const fromStore = getMockPageSectionsAll().find((s) => s.id === id) ?? null;
  const mock = fromStore ?? mockPageSections.find((s) => s.id === id) ?? null;
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getPageSectionByIdFromDb(id), mock);
}

export async function getPopupById(id: string): Promise<Popup | null> {
  const mock = mockPopups.find((p) => p.id === id) ?? null;
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getPopupByIdFromDb(id), mock);
}

export async function getNoticeBarById(id: string): Promise<NoticeBar | null> {
  const mock = mockNoticeBars.find((n) => n.id === id) ?? null;
  if (!isDatabaseConfigured()) return mock;
  return withFallback(() => db.getNoticeBarByIdFromDb(id), mock);
}

/** 저장 (create or update). DB 연결 시에만 반영됨. */
export async function savePageSection(
  data: Omit<PageSection, "createdAt" | "updatedAt">
): Promise<PageSection> {
  if (isDatabaseConfigured()) {
    return db.upsertPageSectionInDb(data);
  }
  return {
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
}

export async function savePopup(
  data: Omit<Popup, "createdAt" | "updatedAt">
): Promise<Popup> {
  if (isDatabaseConfigured()) {
    return db.upsertPopupInDb(data);
  }
  return {
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
}

export async function saveNoticeBar(
  data: Omit<NoticeBar, "createdAt" | "updatedAt">
): Promise<NoticeBar> {
  if (isDatabaseConfigured()) {
    return db.upsertNoticeBarInDb(data);
  }
  return {
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
}

export async function deletePageSection(id: string): Promise<void> {
  if (isDatabaseConfigured()) {
    await db.deletePageSectionInDb(id);
  } else {
    deleteMockPageSectionFromStore(id);
  }
}

export async function softDeletePageSection(id: string): Promise<PageSection | null> {
  if (isDatabaseConfigured()) {
    return db.softDeletePageSectionInDb(id);
  }
  return softDeleteMockPageSection(id);
}

export async function restorePageSection(id: string): Promise<PageSection | null> {
  if (isDatabaseConfigured()) {
    return db.restorePageSectionInDb(id);
  }
  return restoreMockPageSection(id);
}

const PLACEMENT_ORDER_BUILDER: PlacementSlug[] = [
  "below_header",
  "main_visual_bg",
  "below_main_copy",
  "above_content",
  "content_middle",
  "content_bottom",
];

function compareSectionsForAdminLayout(a: PageSection, b: PageSection): number {
  const ad = a.deletedAt ? 1 : 0;
  const bd = b.deletedAt ? 1 : 0;
  if (ad !== bd) return ad - bd;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const ia = PLACEMENT_ORDER_BUILDER.indexOf(a.placement);
  const ib = PLACEMENT_ORDER_BUILDER.indexOf(b.placement);
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.id.localeCompare(b.id);
}

/** 관리자 페이지 빌더: 해당 `page`의 전체 섹션(숨김·기간 무관), 정렬은 sortOrder 우선 */
export async function getPageSectionsForAdminLayoutPage(page: PageSlug): Promise<PageSection[]> {
  const all = await getAllPageSections();
  return all.filter((s) => s.page === page).sort(compareSectionsForAdminLayout);
}

export async function setPageSectionOrderForPage(page: PageSlug, orderedIds: string[]): Promise<void> {
  if (isDatabaseConfigured()) {
    await db.setPageSectionOrderForPageInDb(page, orderedIds);
  } else {
    reorderMockPageSectionOnPage(page, orderedIds);
  }
}

export async function updatePageSectionVisibility(id: string, isVisible: boolean): Promise<PageSection | null> {
  const existing = await getPageSectionById(id);
  if (!existing) return null;
  if (!isDatabaseConfigured()) {
    return savePageSection({ ...existing, isVisible });
  }
  const updated = await db.updatePageSectionVisibilityInDb(id, isVisible);
  if (!updated) return null;
  return {
    ...updated,
    sectionStyleJson: existing.sectionStyleJson ?? updated.sectionStyleJson ?? null,
  };
}

const ALL_PLACEMENTS: PlacementSlug[] = [
  "below_header",
  "main_visual_bg",
  "below_main_copy",
  "above_content",
  "content_middle",
  "content_bottom",
];

function stripSectionForSave(s: PageSection): Omit<PageSection, "createdAt" | "updatedAt"> {
  const { createdAt: _c, updatedAt: _u, ...rest } = s;
  return rest;
}

/** 저장 전 검증용 — 위반 시 throw */
export function assertPageSectionAllowedOnPage(
  page: PageSlug,
  slotType: PageSection["slotType"],
  type: PageSection["type"]
): void {
  if (!isSectionAllowedOnPage(page, slotType, type)) {
    throw new Error("PAGE_SECTION_PAGE_NOT_ALLOWED");
  }
}

export async function movePageSectionToPage(id: string, targetPage: PageSlug): Promise<PageSection> {
  const existing = await getPageSectionById(id);
  if (!existing) throw new Error("NOT_FOUND");
  if (!PAGE_BUILDER_KEYS.includes(targetPage as PageBuilderKey)) {
    throw new Error("INVALID_TARGET_PAGE");
  }
  assertPageSectionAllowedOnPage(targetPage, existing.slotType, existing.type);
  const sourcePage = existing.page;
  if (sourcePage === targetPage) throw new Error("SAME_PAGE");

  const targetRows = await getPageSectionsForAdminLayoutPage(targetPage);
  const maxOrder = targetRows.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  const nextSort = maxOrder + 1;
  await savePageSection({
    ...stripSectionForSave(existing),
    page: targetPage,
    sortOrder: nextSort,
  });

  if (isDatabaseConfigured()) {
    const sourceRows = await getPageSectionsForAdminLayoutPage(sourcePage);
    await setPageSectionOrderForPage(
      sourcePage,
      sourceRows.map((r) => r.id)
    );
  }

  const result = await getPageSectionById(id);
  if (!result) throw new Error("NOT_FOUND");
  return result;
}

export async function duplicatePageSection(id: string, targetPage: PageSlug): Promise<PageSection> {
  const existing = await getPageSectionById(id);
  if (!existing) throw new Error("NOT_FOUND");
  if (!PAGE_BUILDER_KEYS.includes(targetPage as PageBuilderKey)) {
    throw new Error("INVALID_TARGET_PAGE");
  }
  assertPageSectionAllowedOnPage(targetPage, existing.slotType, existing.type);

  const targetRows = await getPageSectionsForAdminLayoutPage(targetPage);
  const maxOrder = targetRows.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  const newId = randomUUID();
  const base = stripSectionForSave(existing);
  const clone: Omit<PageSection, "createdAt" | "updatedAt"> = {
    ...base,
    id: newId,
    page: targetPage,
    sortOrder: maxOrder + 1,
    title: base.title ? `${base.title} (복사)` : "복사",
    buttons: base.buttons.map((b) => ({ ...b, id: randomUUID() })),
    deletedAt: null,
  };
  return savePageSection(clone);
}

export async function updatePageSectionStructure(
  id: string,
  patch: {
    placement?: PlacementSlug;
    startAt?: string | null;
    endAt?: string | null;
    sectionStyleJson?: string | null;
  }
): Promise<PageSection | null> {
  const existing = await getPageSectionById(id);
  if (!existing) return null;
  if (patch.placement !== undefined && !ALL_PLACEMENTS.includes(patch.placement)) {
    throw new Error("INVALID_PLACEMENT");
  }
  const base = stripSectionForSave(existing);
  return savePageSection({
    ...base,
    placement: patch.placement ?? base.placement,
    startAt: patch.startAt !== undefined ? patch.startAt : base.startAt,
    endAt: patch.endAt !== undefined ? patch.endAt : base.endAt,
    sectionStyleJson: patch.sectionStyleJson !== undefined ? patch.sectionStyleJson : base.sectionStyleJson,
  });
}

export async function deletePopup(id: string): Promise<void> {
  if (isDatabaseConfigured()) {
    await db.deletePopupInDb(id);
  }
}

export async function deleteNoticeBar(id: string): Promise<void> {
  if (isDatabaseConfigured()) {
    await db.deleteNoticeBarInDb(id);
  }
}
