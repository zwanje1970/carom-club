/**
 * 홈·커뮤니티·대회 페이지 빌더용 초안(CmsPageLayoutDraft) ↔ 공개(PageSection) 분리.
 * 공개 조회(getOrderedPageBlocksForPage 등)는 항상 DB PageSection만 사용한다.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { PageSection, PageSlug, PlacementSlug } from "@/types/page-section";
import { PAGE_BUILDER_KEYS, type PageBuilderKey } from "@/lib/content/page-section-page-rules";
import * as db from "@/lib/content/db-content";
import {
  assertPublishableDraftSections,
  CMS_DRAFT_SCHEMA_VERSION,
  coercePageSectionFromDraftJson,
  normalizeTrustedSectionForDraft,
} from "@/lib/content/cms-page-draft-normalize";

export { CmsDraftPublishValidationError } from "@/lib/content/cms-page-draft-normalize";

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

export function isCmsPageDraftKey(page: PageSlug): page is PageBuilderKey {
  return (PAGE_BUILDER_KEYS as readonly string[]).includes(page);
}

/** DB에 저장된 JSON에서 섹션 배열만 추출 (레거시: 순수 배열 / 현재: { schemaVersion, sections }) */
export function extractRawSectionsArrayFromStoredJson(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "sections" in raw) {
    const v = (raw as Record<string, unknown>).sections;
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** @deprecated 내부용 — extractRawSectionsArrayFromStoredJson + coerce 사용 권장 */
export function parseSectionsJson(raw: unknown): PageSection[] {
  return extractRawSectionsArrayFromStoredJson(raw) as PageSection[];
}

export async function getDraftSectionsForPage(page: PageBuilderKey): Promise<PageSection[] | null> {
  const row = await prisma.cmsPageLayoutDraft.findUnique({ where: { page } });
  if (!row) return null;
  try {
    const arr = extractRawSectionsArrayFromStoredJson(row.sections);
    const coerced = arr.map((item, i) => coercePageSectionFromDraftJson(page, item, i));
    return coerced.sort(compareSectionsForAdminLayout);
  } catch (e) {
    console.error("[cms-page-draft] draft parse failed for page", page, e);
    return null;
  }
}

export async function getCmsDraftMetaForPage(
  page: PageBuilderKey
): Promise<{ hasDraft: boolean; updatedAt: string | null }> {
  const row = await prisma.cmsPageLayoutDraft.findUnique({
    where: { page },
    select: { updatedAt: true },
  });
  if (!row) return { hasDraft: false, updatedAt: null };
  return { hasDraft: true, updatedAt: row.updatedAt.toISOString() };
}

/** 초안이 없으면 공개(PageSection) 전체 목록(관리자용 필터와 동일 출처) */
export async function loadDraftOrPublishedForAdmin(page: PageBuilderKey): Promise<PageSection[]> {
  const draft = await getDraftSectionsForPage(page);
  if (draft !== null) return draft;
  const all = await db.getAllPageSectionsFromDb();
  return all.filter((s) => s.page === page).sort(compareSectionsForAdminLayout);
}

export async function upsertDraftSections(page: PageBuilderKey, sections: PageSection[]): Promise<void> {
  const normalized = sections.map((s) => normalizeTrustedSectionForDraft(page, s));
  const payload = {
    schemaVersion: CMS_DRAFT_SCHEMA_VERSION,
    sections: normalized,
  } as unknown as Prisma.InputJsonValue;
  await prisma.cmsPageLayoutDraft.upsert({
    where: { page },
    create: { page, sections: payload },
    update: { sections: payload },
  });
}

export async function deleteDraftForPage(page: PageBuilderKey): Promise<void> {
  await prisma.cmsPageLayoutDraft.deleteMany({ where: { page } });
}

/** 공개 DB와 동일한 스냅샷으로 초안 행 생성(이미 있으면 no-op) */
export async function ensureDraftFromPublished(page: PageBuilderKey): Promise<{ created: boolean }> {
  const existing = await prisma.cmsPageLayoutDraft.findUnique({ where: { page } });
  if (existing) return { created: false };
  const all = await db.getAllPageSectionsFromDb();
  const rows = all.filter((s) => s.page === page).sort(compareSectionsForAdminLayout);
  const normalized = rows.map((s) => normalizeTrustedSectionForDraft(page, s));
  const payload = {
    schemaVersion: CMS_DRAFT_SCHEMA_VERSION,
    sections: normalized,
  } as unknown as Prisma.InputJsonValue;
  await prisma.cmsPageLayoutDraft.create({
    data: {
      page,
      sections: payload,
    },
  });
  return { created: true };
}

/**
 * 초안 → 공개 PageSection 반영 후 초안 행 삭제.
 * 검증 실패 시 DB 반영 없이 CmsDraftPublishValidationError.
 */
export async function publishCmsPageLayoutDraft(page: PageBuilderKey): Promise<{ publishedAt: string }> {
  const row = await prisma.cmsPageLayoutDraft.findUnique({ where: { page } });
  if (!row) {
    throw new Error("NO_DRAFT");
  }
  const arr = extractRawSectionsArrayFromStoredJson(row.sections);
  const coerced = arr.map((item, i) => coercePageSectionFromDraftJson(page, item, i));
  assertPublishableDraftSections(page, coerced);
  const forDb = coerced.map((s) => ({ ...s, page }));
  await db.replacePageSectionsForPublishedPageInDb(page, forDb);
  await prisma.cmsPageLayoutDraft.delete({ where: { page } });
  return { publishedAt: new Date().toISOString() };
}
