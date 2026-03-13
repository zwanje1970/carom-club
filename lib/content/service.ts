/**
 * CMS 콘텐츠 서비스
 * - DATABASE_URL 있으면: Prisma DB 사용 (수정 내용 메인에 반영)
 * - 없으면: mock 데이터 사용
 */

import { isDatabaseConfigured } from "@/lib/db-mode";
import { mockPageSections } from "./mock-data";
import { mockPopups } from "./mock-data";
import { mockNoticeBars } from "./mock-data";
import * as db from "./db-content";
import type { PageSection } from "@/types/page-section";
import type { Popup } from "@/types/popup";
import type { NoticeBar } from "@/types/notice-bar";
import type { PageSlug, PlacementSlug } from "@/types/page-section";
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

/** 페이지별 노출 중인 섹션 (isVisible + 기간 내), sortOrder 오름차순. DB 비어 있으면 mock으로 동일 화면 유지 */
export async function getPageSectionsForPage(page: PageSlug): Promise<PageSection[]> {
  const mock = mockPageSections
    .filter((s) => s.page === page && s.isVisible && isInRange(s.startAt, s.endAt))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!isDatabaseConfigured()) return mock;
  const result = await withFallback(() => db.getPageSectionsForPageFromDb(page), mock);
  return result.length > 0 ? result : mock;
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
  const mock = mockPageSections.find((s) => s.id === id) ?? null;
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
  }
}

export async function reorderPageSections(
  page: PageSlug,
  placement: PlacementSlug,
  sectionIds: string[]
): Promise<void> {
  if (isDatabaseConfigured()) {
    await db.reorderPageSectionsInDb(page, placement, sectionIds);
  }
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
