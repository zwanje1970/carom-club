/**
 * DATABASE_URL 없을 때 pageSection CRUD·순서를 메모리에 유지(새로고침 전까지).
 * 개발·스테이징에서 관리자 빌더 사용성 보완용.
 */
import type { PageSection, PageSlug } from "@/types/page-section";
import { mockPageSections as seed } from "./mock-data";

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

let store: PageSection[] = deepClone(seed);

const isoNow = () => new Date().toISOString();

/** 테스트 등에서 시드로 되돌릴 때만 사용 */
export function resetMockPageSectionsStoreForTests(): void {
  store = deepClone(seed);
}

export function getMockPageSectionsAll(): PageSection[] {
  return store.map((s) => ({
    ...s,
    buttons: Array.isArray(s.buttons) ? s.buttons.map((b) => ({ ...b })) : [],
  }));
}

export function upsertMockPageSection(data: Omit<PageSection, "createdAt" | "updatedAt">): PageSection {
  const existing = store.find((r) => r.id === data.id);
  const t = isoNow();
  const mergedDeletedAt =
    data.deletedAt !== undefined ? data.deletedAt : (existing?.deletedAt ?? null);
  const row: PageSection = {
    ...data,
    deletedAt: mergedDeletedAt,
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  };
  if (existing) {
    store[store.indexOf(existing)] = row;
  } else {
    store.push(row);
  }
  return row;
}

export function deleteMockPageSectionFromStore(id: string): void {
  store = store.filter((r) => r.id !== id);
}

export function softDeleteMockPageSection(id: string): PageSection | null {
  const row = store.find((r) => r.id === id);
  if (!row) return null;
  const t = isoNow();
  const next: PageSection = { ...row, deletedAt: t, updatedAt: t };
  store[store.indexOf(row)] = next;
  return next;
}

export function restoreMockPageSection(id: string): PageSection | null {
  const row = store.find((r) => r.id === id);
  if (!row) return null;
  const t = isoNow();
  const next: PageSection = { ...row, deletedAt: null, updatedAt: t };
  store[store.indexOf(row)] = next;
  return next;
}

export function reorderMockPageSectionOnPage(page: PageSlug, orderedIds: string[]): void {
  const pageRows = store.filter((r) => r.page === page);
  const idSet = new Set(pageRows.map((r) => r.id));
  if (orderedIds.length === 0) {
    if (idSet.size !== 0) throw new Error("PAGE_LAYOUT_ORDER_MISMATCH");
    return;
  }
  if (orderedIds.length !== idSet.size || orderedIds.some((id) => !idSet.has(id))) {
    throw new Error("PAGE_LAYOUT_ORDER_MISMATCH");
  }
  orderedIds.forEach((id, index) => {
    const row = store.find((r) => r.id === id);
    if (row) row.sortOrder = index;
  });
}
