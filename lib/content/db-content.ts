/**
 * CMS 콘텐츠 DB 조회/저장 (Prisma)
 * service.ts 에서 DATABASE_URL 이 있을 때만 사용
 */

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
  createdAt: Date;
  updatedAt: Date;
}): PageSection {
  const buttonsRaw = r.buttons;
  const buttons: SectionButton[] =
    typeof buttonsRaw === "string"
      ? (buttonsRaw ? (JSON.parse(buttonsRaw) as SectionButton[]) : [])
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
    where: { page, isVisible: true },
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
  const list = await prisma.popup.findMany({ orderBy: { sortOrder: "asc" } });
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

export async function upsertPageSectionInDb(data: PageSectionInput): Promise<PageSection> {
  const payload = {
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
    buttons: Array.isArray(data.buttons) ? JSON.stringify(data.buttons) : (data.buttons != null ? JSON.stringify(data.buttons) : null),
    isVisible: data.isVisible,
    sortOrder: data.sortOrder,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
  };
  const r = await prisma.pageSection.upsert({
    where: { id: data.id },
    create: { id: data.id, ...payload },
    update: payload,
  });
  return rowToPageSection(r);
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

export async function deletePopupInDb(id: string): Promise<void> {
  await prisma.popup.delete({ where: { id } }).catch(() => {});
}

export async function deleteNoticeBarInDb(id: string): Promise<void> {
  await prisma.noticeBar.delete({ where: { id } }).catch(() => {});
}

export async function reorderPageSectionsInDb(
  page: PageSlug,
  placement: PlacementSlug,
  sectionIds: string[]
): Promise<void> {
  await prisma.$transaction(
    sectionIds.map((id, index) =>
      prisma.pageSection.updateMany({
        where: { id, page, placement },
        data: { sortOrder: index },
      })
    )
  );
}
