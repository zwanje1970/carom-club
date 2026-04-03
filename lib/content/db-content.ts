/**
 * CMS 콘텐츠 DB 조회/저장 (Prisma)
 * service.ts 에서 DATABASE_URL 이 있을 때만 사용
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { PageSection, SectionButton } from "@/types/page-section";
import type { Popup } from "@/types/popup";
import type { NoticeBar } from "@/types/notice-bar";
import type { PageSlug, PlacementSlug } from "@/types/page-section";
import type { PopupPageSlug } from "@/types/popup";
import type { NoticeBarPageSlug } from "@/types/notice-bar";

function toISO(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function parseSectionButtonsSafe(raw: string): SectionButton[] {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as SectionButton[]) : [];
  } catch {
    return [];
  }
}

function rowToPageSection(r: {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  textAlign: string;
  page: string;
  placement: string;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  imageHeightPc: number | null;
  imageHeightMobile: number | null;
  linkType: string;
  internalPage: string | null;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  buttons: unknown;
  isVisible: boolean;
  sortOrder: number;
  startAt: Date | null;
  endAt: Date | null;
  backgroundColor?: string | null;
  titleIconType?: string | null;
  titleIconName?: string | null;
  titleIconImageUrl?: string | null;
  titleIconSize?: string | null;
  sectionStyleJson?: string | null;
  slotType?: string | null;
  slotConfigJson?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PageSection {
  const buttonsRaw = r.buttons;
  const buttons: SectionButton[] =
    typeof buttonsRaw === "string"
      ? parseSectionButtonsSafe(buttonsRaw)
      : (Array.isArray(buttonsRaw) ? buttonsRaw : []);
  return {
    id: r.id,
    type: r.type as PageSection["type"],
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    textAlign: r.textAlign as PageSection["textAlign"],
    page: r.page as PageSlug,
    placement: r.placement as PlacementSlug,
    imageUrl: r.imageUrl,
    imageUrlMobile: r.imageUrlMobile,
    imageHeightPc: r.imageHeightPc,
    imageHeightMobile: r.imageHeightMobile,
    linkType: r.linkType as PageSection["linkType"],
    internalPage: r.internalPage as PageSection["internalPage"],
    internalPath: r.internalPath,
    externalUrl: r.externalUrl,
    openInNewTab: r.openInNewTab,
    buttons,
    isVisible: r.isVisible,
    sortOrder: r.sortOrder,
    startAt: toISO(r.startAt),
    endAt: toISO(r.endAt),
    backgroundColor: r.backgroundColor ?? null,
    titleIconType: (r.titleIconType as PageSection["titleIconType"]) ?? null,
    titleIconName: r.titleIconName ?? null,
    titleIconImageUrl: r.titleIconImageUrl ?? null,
    titleIconSize: (r.titleIconSize as PageSection["titleIconSize"]) ?? null,
    sectionStyleJson: r.sectionStyleJson ?? null,
    slotType: (r.slotType as PageSection["slotType"]) ?? null,
    slotConfigJson: r.slotConfigJson ?? null,
    deletedAt: toISO(r.deletedAt ?? null),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToPopup(r: {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  buttonName: string | null;
  buttonLink: string | null;
  page: string;
  startAt: Date | null;
  endAt: Date | null;
  hideForTodayEnabled: boolean;
  showCloseButton: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): Popup {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    buttonName: r.buttonName,
    buttonLink: r.buttonLink,
    page: r.page as PopupPageSlug,
    startAt: toISO(r.startAt),
    endAt: toISO(r.endAt),
    hideForTodayEnabled: r.hideForTodayEnabled,
    showCloseButton: r.showCloseButton,
    isVisible: r.isVisible,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToNoticeBar(r: {
  id: string;
  message: string;
  linkType: string;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  backgroundColor: string;
  textColor: string;
  page: string;
  position: string;
  startAt: Date | null;
  endAt: Date | null;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): NoticeBar {
  return {
    id: r.id,
    message: r.message,
    linkType: r.linkType as NoticeBar["linkType"],
    internalPath: r.internalPath,
    externalUrl: r.externalUrl,
    openInNewTab: r.openInNewTab,
    backgroundColor: r.backgroundColor,
    textColor: r.textColor,
    page: r.page as NoticeBarPageSlug,
    position: r.position as NoticeBar["position"],
    startAt: toISO(r.startAt),
    endAt: toISO(r.endAt),
    isVisible: r.isVisible,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function isInRange(startAt: string | null, endAt: string | null): boolean {
  const t = Date.now();
  if (startAt && new Date(startAt).getTime() > t) return false;
  if (endAt && new Date(endAt).getTime() < t) return false;
  return true;
}

export async function getPageSectionsForPageFromDb(page: PageSlug): Promise<PageSection[]> {
  const list = await prisma.pageSection.findMany({
    where: { page, isVisible: true, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return list
    .filter((s) => isInRange(s.startAt?.toISOString() ?? null, s.endAt?.toISOString() ?? null))
    .map((r) => rowToPageSection(r));
}

/** 구조 슬롯 행만: `page` + 노출 + 기간 내, `sortOrder` 오름차순 */
export async function getPageLayoutSlotsForPageFromDb(page: PageSlug): Promise<PageSection[]> {
  const list = await prisma.pageSection.findMany({
    where: { page, isVisible: true, slotType: { not: null }, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return list
    .filter((s) => isInRange(s.startAt?.toISOString() ?? null, s.endAt?.toISOString() ?? null))
    .map((r) => rowToPageSection(r));
}

/** 동일 `page`의 CMS+슬롯 전부 한 목록으로(구조 편집·미리보기용). 공개 렌더는 기존 API 유지 */
export async function getOrderedPageBlocksForPageFromDb(page: PageSlug): Promise<PageSection[]> {
  const list = await prisma.pageSection.findMany({
    where: { page, isVisible: true, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return list
    .filter((s) => isInRange(s.startAt?.toISOString() ?? null, s.endAt?.toISOString() ?? null))
    .map((r) => rowToPageSection(r));
}

export async function getPopupsForPageFromDb(page: PopupPageSlug): Promise<Popup[]> {
  const list = await prisma.popup.findMany({
    where: { OR: [{ page: "all" }, { page }], isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
  return list
    .filter((p) => isInRange(p.startAt?.toISOString() ?? null, p.endAt?.toISOString() ?? null))
    .map((r) => rowToPopup(r));
}

export async function getNoticeBarsForPageFromDb(page: NoticeBarPageSlug): Promise<NoticeBar[]> {
  const list = await prisma.noticeBar.findMany({
    where: { OR: [{ page: "all" }, { page }], isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
  return list
    .filter((n) => isInRange(n.startAt?.toISOString() ?? null, n.endAt?.toISOString() ?? null))
    .map((r) => rowToNoticeBar(r));
}

export async function getAllPageSectionsFromDb(): Promise<PageSection[]> {
  const list = await prisma.pageSection.findMany({ orderBy: [{ page: "asc" }, { placement: "asc" }, { sortOrder: "asc" }] });
  return list.map((r) => rowToPageSection(r));
}

export async function getAllPopupsFromDb(): Promise<Popup[]> {
  const list = await prisma.popup.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
  return list.map((r) => rowToPopup(r));
}

export async function getAllNoticeBarsFromDb(): Promise<NoticeBar[]> {
  const list = await prisma.noticeBar.findMany({ orderBy: { sortOrder: "asc" } });
  return list.map((r) => rowToNoticeBar(r));
}

export async function getPageSectionByIdFromDb(id: string): Promise<PageSection | null> {
  const r = await prisma.pageSection.findUnique({ where: { id } });
  return r ? rowToPageSection(r) : null;
}

export async function getPopupByIdFromDb(id: string): Promise<Popup | null> {
  const r = await prisma.popup.findUnique({ where: { id } });
  return r ? rowToPopup(r) : null;
}

export async function getNoticeBarByIdFromDb(id: string): Promise<NoticeBar | null> {
  const r = await prisma.noticeBar.findUnique({ where: { id } });
  return r ? rowToNoticeBar(r) : null;
}

type PageSectionInput = Omit<PageSection, "createdAt" | "updatedAt">;
type PopupInput = Omit<Popup, "createdAt" | "updatedAt">;
type NoticeBarInput = Omit<NoticeBar, "createdAt" | "updatedAt">;

/** DB가 아직 `sectionStyleJson` 컬럼이 없을 때(P2022)에도 표시 토글이 동작하도록, 해당 컬럼을 읽지 않는 select */
const PAGE_SECTION_SELECT_VISIBILITY_PATCH = {
  id: true,
  type: true,
  title: true,
  subtitle: true,
  description: true,
  textAlign: true,
  page: true,
  placement: true,
  imageUrl: true,
  imageUrlMobile: true,
  imageHeightPc: true,
  imageHeightMobile: true,
  linkType: true,
  internalPage: true,
  internalPath: true,
  externalUrl: true,
  openInNewTab: true,
  buttons: true,
  isVisible: true,
  sortOrder: true,
  startAt: true,
  endAt: true,
  backgroundColor: true,
  titleIconType: true,
  titleIconName: true,
  titleIconImageUrl: true,
  titleIconSize: true,
  slotType: true,
  slotConfigJson: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** `isVisible`만 갱신. 전체 upsert는 스키마에만 있고 DB에 없는 컬럼이 있으면 P2022가 나므로 토글 전용 경로로 분리 */
export async function updatePageSectionVisibilityInDb(id: string, isVisible: boolean): Promise<PageSection | null> {
  try {
    const r = await prisma.pageSection.update({
      where: { id },
      data: { isVisible },
      select: PAGE_SECTION_SELECT_VISIBILITY_PATCH,
    });
    return rowToPageSection({ ...r, sectionStyleJson: null });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2025") return null;
    throw e;
  }
}

function buildPageSectionUpsertPayload(
  data: PageSectionInput,
  existingDeletedAt: Date | null | undefined
) {
  let mergedDeletedAt: Date | null;
  if (data.deletedAt === undefined) {
    mergedDeletedAt = existingDeletedAt ?? null;
  } else if (!data.deletedAt) {
    mergedDeletedAt = null;
  } else {
    mergedDeletedAt = new Date(data.deletedAt);
  }

  return {
    type: data.type,
    title: data.title,
    subtitle: data.subtitle ?? null,
    description: data.description ?? null,
    textAlign: data.textAlign,
    page: data.page,
    placement: data.placement,
    imageUrl: data.imageUrl ?? null,
    imageUrlMobile: data.imageUrlMobile ?? null,
    imageHeightPc: data.imageHeightPc ?? null,
    imageHeightMobile: data.imageHeightMobile ?? null,
    linkType: data.linkType,
    internalPage: data.internalPage ?? null,
    internalPath: data.internalPath ?? null,
    externalUrl: data.externalUrl ?? null,
    openInNewTab: data.openInNewTab,
    buttons: Array.isArray(data.buttons)
      ? JSON.stringify(data.buttons)
      : data.buttons != null
        ? JSON.stringify(data.buttons)
        : null,
    isVisible: data.isVisible,
    sortOrder: data.sortOrder,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    backgroundColor: data.backgroundColor ?? null,
    titleIconType: data.titleIconType ?? null,
    titleIconName: data.titleIconName ?? null,
    titleIconImageUrl: data.titleIconImageUrl ?? null,
    titleIconSize: data.titleIconSize ?? null,
    sectionStyleJson: data.sectionStyleJson ?? null,
    slotType: data.slotType ?? null,
    slotConfigJson: data.slotConfigJson ?? null,
    deletedAt: mergedDeletedAt,
  };
}

export async function upsertPageSectionInDb(data: PageSectionInput): Promise<PageSection> {
  const existing = await prisma.pageSection.findUnique({
    where: { id: data.id },
    select: { deletedAt: true },
  });
  const payload = buildPageSectionUpsertPayload(data, existing?.deletedAt);
  const r = await prisma.pageSection.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
  return rowToPageSection(r);
}

/** 게시(draft → PageSection) 시 트랜잭션 내에서 동일 upsert */
export async function upsertPageSectionInDbTx(tx: Prisma.TransactionClient, data: PageSectionInput): Promise<PageSection> {
  const existing = await tx.pageSection.findUnique({
    where: { id: data.id },
    select: { deletedAt: true },
  });
  const payload = buildPageSectionUpsertPayload(data, existing?.deletedAt);
  const r = await tx.pageSection.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
  return rowToPageSection(r);
}

/** 초안 게시: `page`의 공개 `PageSection` 행을 `sections` 스냅샷과 일치시킴(추가·갱신·삭제) */
export async function replacePageSectionsForPublishedPageInDb(page: PageSlug, sections: PageSection[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (sections.length === 0) {
      await tx.pageSection.deleteMany({ where: { page } });
      return;
    }
    const ids = new Set(sections.map((s) => s.id));
    const existing = await tx.pageSection.findMany({ where: { page }, select: { id: true } });
    for (const e of existing) {
      if (!ids.has(e.id)) {
        await tx.pageSection.delete({ where: { id: e.id } });
      }
    }
    for (const s of sections) {
      await upsertPageSectionInDbTx(tx, stripSectionForDbUpsert({ ...s, page }));
    }
  });
}

function stripSectionForDbUpsert(s: PageSection): PageSectionInput {
  const { createdAt: _c, updatedAt: _u, ...rest } = s;
  return rest;
}

export async function upsertPopupInDb(data: PopupInput): Promise<Popup> {
  const payload = {
    title: data.title,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    buttonName: data.buttonName ?? null,
    buttonLink: data.buttonLink ?? null,
    page: data.page,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    hideForTodayEnabled: data.hideForTodayEnabled,
    showCloseButton: data.showCloseButton,
    isVisible: data.isVisible,
    sortOrder: data.sortOrder,
  };
  const r = await prisma.popup.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
  return rowToPopup(r);
}

export async function upsertNoticeBarInDb(data: NoticeBarInput): Promise<NoticeBar> {
  const payload = {
    message: data.message,
    linkType: data.linkType,
    internalPath: data.internalPath ?? null,
    externalUrl: data.externalUrl ?? null,
    openInNewTab: data.openInNewTab,
    backgroundColor: data.backgroundColor,
    textColor: data.textColor,
    page: data.page,
    position: data.position,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
    isVisible: data.isVisible,
    sortOrder: data.sortOrder,
  };
  const r = await prisma.noticeBar.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
  return rowToNoticeBar(r);
}

export async function deletePageSectionInDb(id: string): Promise<void> {
  await prisma.pageSection.delete({ where: { id } }).catch(() => {});
}

export async function softDeletePageSectionInDb(id: string): Promise<PageSection | null> {
  try {
    const r = await prisma.pageSection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return rowToPageSection(r);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2025") return null;
    throw e;
  }
}

export async function restorePageSectionInDb(id: string): Promise<PageSection | null> {
  try {
    const r = await prisma.pageSection.update({
      where: { id },
      data: { deletedAt: null },
    });
    return rowToPageSection(r);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2025") return null;
    throw e;
  }
}

export async function deletePopupInDb(id: string): Promise<void> {
  await prisma.popup.delete({ where: { id } }).catch(() => {});
}

export async function deleteNoticeBarInDb(id: string): Promise<void> {
  await prisma.noticeBar.delete({ where: { id } }).catch(() => {});
}

/** 동일 `page`의 모든 섹션 `sortOrder`를 `orderedIds` 순으로 0…n-1 재부여 (페이지 빌더용) */
export async function setPageSectionOrderForPageInDb(page: PageSlug, orderedIds: string[]): Promise<void> {
  const existing = await prisma.pageSection.findMany({
    where: { page },
    select: { id: true },
  });
  const idSet = new Set(existing.map((e) => e.id));
  if (orderedIds.length === 0) {
    if (idSet.size !== 0) throw new Error("PAGE_LAYOUT_ORDER_MISMATCH");
    return;
  }
  if (orderedIds.length !== idSet.size || orderedIds.some((id) => !idSet.has(id))) {
    throw new Error("PAGE_LAYOUT_ORDER_MISMATCH");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.pageSection.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );
}
