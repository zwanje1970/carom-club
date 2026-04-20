import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import MainSceneSlideDeckClient from "./main-scene-slide-deck-client";
import { SiteMainNavIcon } from "./main-nav-icon";
import { getCommonPaletteColorHex, isCommonPaletteColor } from "../../lib/shared/common-color-palette";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import {
  getClientStatusByUserId,
  getSiteNotice,
  getSitePageBuilderDraftByPageId,
  getSitePageBuilderPublishedByPageId,
  getUserById,
  listTournamentSnapshotsForMainSite,
} from "../../lib/server/dev-store";
import SiteShellFrame from "./components/SiteShellFrame";
import SiteMainLogo from "./components/SiteMainLogo";
import VenuesDistanceNavLink from "./components/VenuesDistanceNavLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const HOME_PAGE_ID = "home";

type BlockAlignment = "LEFT" | "CENTER" | "RIGHT";
type SlideSortType = "DEADLINE" | "DISTANCE" | "BILLIARD_ONLY" | "MIXED";
type StyleSize = "sm" | "md" | "lg";
type StyleLayout = "full" | "box";
type StyleColorToken = string;
type StyleBackground = "none" | "light" | "accent" | StyleColorToken;
type StyleBorderWidth = "none" | "thin" | "normal" | "thick";
type StyleBorderColor = "light" | "default" | "strong" | StyleColorToken;
type StyleBorderStyle = "solid" | "dashed";
type StyleSpace = "none" | "sm" | "md" | "lg";
type StyleFontSize = "sm" | "md" | "lg";
type StyleTextColor = "default" | "muted" | "primary" | StyleColorToken;
type StyleFontWeight = "normal" | "medium" | "bold";

type CommonBlockStyle = {
  size?: StyleSize;
  layout?: StyleLayout;
  background?: StyleBackground;
  border?: {
    width?: StyleBorderWidth;
    color?: StyleBorderColor;
    style?: StyleBorderStyle;
  };
  padding?: StyleSpace;
  margin?: StyleSpace;
  fontSize?: StyleFontSize;
  textColor?: StyleTextColor;
  fontWeight?: StyleFontWeight;
};

type HomeBlock =
  | { id: string; type: "TITLE"; data: { text: string; alignment: BlockAlignment; style?: CommonBlockStyle } }
  | {
      id: string;
      type: "BUTTON";
      data: {
        label: string;
        role: "NAVIGATE" | "SORT_TRIGGER";
        alignment: BlockAlignment;
        style?: CommonBlockStyle;
        link: string;
        sortType: SlideSortType | null;
      };
    }
  | { id: string; type: "LINK"; data: { text: string; href: string; alignment: BlockAlignment; style?: CommonBlockStyle } }
  | {
      id: string;
      type: "SLIDE_CARDS";
      data: {
        cardSourceType: "TOURNAMENT_SNAPSHOT" | "VENUE_SNAPSHOT";
        sortType: SlideSortType;
        itemLimit: number;
        alignment: BlockAlignment;
        style?: CommonBlockStyle;
        cardLayout?: "vertical" | "horizontal";
        direction?: "vertical" | "horizontal";
        peekRatio?: number;
        autoPlay: boolean;
        pauseOnHover: boolean;
      };
    }
  | { id: string; type: "NOTICE"; data: { text: string; link?: string; visible?: boolean; style?: CommonBlockStyle } }
  | { id: string; type: "SPACER"; data: { size: number; style?: CommonBlockStyle } }
  | { id: string; type: "DIVIDER"; data: { lineStyle: "SOLID"; style?: CommonBlockStyle } };

function parseAlignment(value: unknown): BlockAlignment {
  if (value === "CENTER") return "CENTER";
  if (value === "RIGHT") return "RIGHT";
  return "LEFT";
}

function normalizeBlockStyle(input: unknown): CommonBlockStyle | undefined {
  if (!input || typeof input !== "object") return undefined;
  const row = input as {
    size?: unknown;
    layout?: unknown;
    background?: unknown;
    border?: { width?: unknown; color?: unknown; style?: unknown } | unknown;
    padding?: unknown;
    margin?: unknown;
    fontSize?: unknown;
    textColor?: unknown;
    fontWeight?: unknown;
  };
  const style: CommonBlockStyle = {};
  if (row.size === "sm" || row.size === "md" || row.size === "lg") style.size = row.size;
  if (row.layout === "full" || row.layout === "box") style.layout = row.layout;
  if (row.background === "none" || row.background === "light" || row.background === "accent" || isCommonPaletteColor(row.background)) {
    style.background = row.background;
  }
  if (row.padding === "none" || row.padding === "sm" || row.padding === "md" || row.padding === "lg") style.padding = row.padding;
  if (row.margin === "none" || row.margin === "sm" || row.margin === "md" || row.margin === "lg") style.margin = row.margin;
  if (row.fontSize === "sm" || row.fontSize === "md" || row.fontSize === "lg") style.fontSize = row.fontSize;
  if (row.textColor === "default" || row.textColor === "muted" || row.textColor === "primary" || isCommonPaletteColor(row.textColor)) {
    style.textColor = row.textColor;
  }
  if (row.fontWeight === "normal" || row.fontWeight === "medium" || row.fontWeight === "bold") style.fontWeight = row.fontWeight;
  if (row.border && typeof row.border === "object") {
    const borderRow = row.border as { width?: unknown; color?: unknown; style?: unknown };
    const border: NonNullable<CommonBlockStyle["border"]> = {};
    if (
      borderRow.width === "none" ||
      borderRow.width === "thin" ||
      borderRow.width === "normal" ||
      borderRow.width === "thick"
    ) border.width = borderRow.width;
    if (borderRow.color === "light" || borderRow.color === "default" || borderRow.color === "strong" || isCommonPaletteColor(borderRow.color)) {
      border.color = borderRow.color;
    }
    if (borderRow.style === "solid" || borderRow.style === "dashed") border.style = borderRow.style;
    if (Object.keys(border).length > 0) style.border = border;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function isSlideSortType(value: unknown): value is SlideSortType {
  return value === "DEADLINE" || value === "DISTANCE" || value === "BILLIARD_ONLY" || value === "MIXED";
}

function toSearchString(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  value: string
): string {
  const next = new URLSearchParams();
  for (const [paramKey, paramValue] of Object.entries(searchParams)) {
    if (Array.isArray(paramValue)) {
      for (const item of paramValue) {
        next.append(paramKey, item);
      }
      continue;
    }
    if (typeof paramValue === "string") {
      next.set(paramKey, paramValue);
    }
  }
  next.set(key, value);
  return `?${next.toString()}`;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizePublishedBlocks(input: unknown): HomeBlock[] {
  if (!Array.isArray(input)) return [];
  const mappedBlocks: Array<HomeBlock | null> = input.map((raw): HomeBlock | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as { id?: unknown; type?: unknown; data?: unknown };
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const type = typeof row.type === "string" ? row.type : "";
      const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
      if (!id) return null;

      if (type === "TITLE") {
        return {
          id,
          type: "TITLE" as const,
          data: {
            text: typeof data.text === "string" ? data.text : "",
            alignment: parseAlignment(data.alignment),
            style: normalizeBlockStyle(data.style),
          },
        };
      }
      if (type === "BUTTON") {
        const role = data.role === "SORT_TRIGGER" ? "SORT_TRIGGER" : "NAVIGATE";
        const sortType = isSlideSortType(data.sortType) ? data.sortType : null;
        return {
          id,
          type: "BUTTON" as const,
          data: {
            label: typeof data.label === "string" ? data.label : "정렬 버튼",
            role,
            alignment: parseAlignment(data.alignment),
            link: typeof data.link === "string" && data.link.trim() ? data.link : "/site",
            sortType,
            style: normalizeBlockStyle(data.style),
          },
        };
      }
      if (type === "LINK") {
        return {
          id,
          type: "LINK" as const,
          data: {
            text: typeof data.text === "string" ? data.text : "링크",
            href: typeof data.href === "string" && data.href.trim() ? data.href : "/site",
            alignment: parseAlignment(data.alignment),
            style: normalizeBlockStyle(data.style),
          },
        };
      }
      if (type === "SLIDE_CARDS") {
        const cardSourceType =
          data.cardSourceType === "VENUE_SNAPSHOT" ? "VENUE_SNAPSHOT" : "TOURNAMENT_SNAPSHOT";
        const rawSortType = typeof data.sortType === "string" ? data.sortType : "";
        const sortType: SlideSortType =
          rawSortType === "DISTANCE" ||
          rawSortType === "BILLIARD_ONLY" ||
          rawSortType === "MIXED" ||
          rawSortType === "DEADLINE"
            ? rawSortType
            : "DEADLINE";
        const itemLimitRaw = Number.parseInt(String(data.itemLimit ?? 6), 10);
        return {
          id,
          type: "SLIDE_CARDS" as const,
          data: {
            cardSourceType,
            sortType,
            itemLimit: Number.isFinite(itemLimitRaw) ? Math.max(1, Math.min(30, itemLimitRaw)) : 6,
            alignment: parseAlignment(data.alignment),
            style: normalizeBlockStyle(data.style),
            cardLayout:
              data.cardLayout === "horizontal" || data.cardLayout === "vertical"
                ? data.cardLayout
                : undefined,
            direction:
              data.direction === "vertical" || data.direction === "horizontal"
                ? data.direction
                : undefined,
            peekRatio:
              Number.isFinite(Number(data.peekRatio))
                ? Math.max(0, Math.min(0.3, Number(data.peekRatio)))
                : undefined,
            autoPlay: typeof data.autoPlay === "boolean" ? data.autoPlay : true,
            pauseOnHover: typeof data.pauseOnHover === "boolean" ? data.pauseOnHover : true,
          },
        };
      }
      if (type === "NOTICE") {
        const text = typeof data.text === "string" ? data.text : typeof (row as { text?: unknown }).text === "string" ? String((row as { text?: unknown }).text) : "";
        const link = typeof data.link === "string" ? data.link : typeof (row as { link?: unknown }).link === "string" ? String((row as { link?: unknown }).link) : "";
        const visibleRaw =
          typeof data.visible === "boolean"
            ? data.visible
            : typeof (row as { visible?: unknown }).visible === "boolean"
              ? Boolean((row as { visible?: unknown }).visible)
              : true;
        return {
          id,
          type: "NOTICE" as const,
          data: {
            text,
            link,
            visible: visibleRaw,
            style: normalizeBlockStyle(data.style),
          },
        };
      }
      if (type === "SPACER") {
        const sizeRaw = Number.parseInt(String(data.size ?? 24), 10);
        return {
          id,
          type: "SPACER" as const,
          data: {
            size: Number.isFinite(sizeRaw) ? Math.max(4, Math.min(120, sizeRaw)) : 24,
            style: normalizeBlockStyle(data.style),
          },
        };
      }
      if (type === "DIVIDER") {
        return { id, type: "DIVIDER" as const, data: { lineStyle: "SOLID", style: normalizeBlockStyle(data.style) } };
      }
      return null;
    });
  return mappedBlocks.filter((block): block is HomeBlock => block !== null);
}

export default async function SiteHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedPageId = readSearchParam(resolvedSearchParams, "pageId")?.trim() || HOME_PAGE_ID;
  const previewMode = readSearchParam(resolvedSearchParams, "previewMode") === "draft";
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(rawSession);
  const currentUser = session ? await getUserById(session.userId) : null;
  const clientApplicationStatus =
    session && currentUser?.role === "CLIENT" ? await getClientStatusByUserId(session.userId) : null;
  const clientDashboardApproved = currentUser?.role === "CLIENT" && clientApplicationStatus === "APPROVED";
  const canUseDraftPreview = previewMode ? Boolean(currentUser && currentUser.role === "PLATFORM") : false;

  const [publishedPage, mainSlideSnapshots, siteNotice] = await Promise.all([
    canUseDraftPreview
      ? getSitePageBuilderDraftByPageId(requestedPageId)
      : getSitePageBuilderPublishedByPageId(requestedPageId),
    listTournamentSnapshotsForMainSite(),
    getSiteNotice().catch(() => ({ enabled: false, text: "" })),
  ]);

  const sections = publishedPage
    ? publishedPage.sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          id: section.id,
          blocks: normalizePublishedBlocks(section.blocks),
        }))
    : [];

  const flattenedBlocks = sections.flatMap((section) =>
    section.blocks.map((block) => ({
      sectionId: section.id,
      block,
    }))
  );
  const tournamentSlideEntry = flattenedBlocks.find(
    (item): item is { sectionId: string; block: Extract<HomeBlock, { type: "SLIDE_CARDS" }> } =>
      item.block.type === "SLIDE_CARDS" && item.block.data.cardSourceType === "TOURNAMENT_SNAPSHOT"
  );
  const findTitleBefore = (targetBlockId: string | undefined) => {
    if (!targetBlockId) return null;
    const targetIndex = flattenedBlocks.findIndex((item) => item.block.id === targetBlockId);
    if (targetIndex < 0) return null;
    for (let i = targetIndex - 1; i >= 0; i -= 1) {
      const candidate = flattenedBlocks[i];
      if (candidate.block.type === "TITLE") {
        return candidate as { sectionId: string; block: Extract<HomeBlock, { type: "TITLE" }> };
      }
    }
    return null;
  };
  const tournamentTitleEntry = findTitleBefore(tournamentSlideEntry?.block.id);
  const fixedMainButtons = [
    { label: "대회안내", href: "/site/tournaments" },
    { label: "주변당구장", href: "/site/venues" },
    { label: "커뮤니티", href: "/site/community" },
    { label: "마이페이지", href: "/site/mypage" },
  ];
  const mainNavVariants: Record<
    (typeof fixedMainButtons)[number]["label"],
    "tournament" | "venue" | "community" | "user"
  > = {
    대회안내: "tournament",
    주변당구장: "venue",
    커뮤니티: "community",
    마이페이지: "user",
  };
  const dashboardHref =
    currentUser?.role === "PLATFORM"
      ? "/platform"
      : clientDashboardApproved
        ? "/client"
        : null;
  const dashboardLabel = dashboardHref
    ? currentUser?.role === "PLATFORM"
      ? "플랫폼관리자"
      : "대시보드"
    : null;
  const liveSlideItems = mainSlideSnapshots.map((snapshot) => ({
    snapshotId: snapshot.snapshotId,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    image320Url: snapshot.image320Url,
    statusBadge: snapshot.statusBadge,
    cardExtraLine1: snapshot.cardExtraLine1,
    cardExtraLine2: snapshot.cardExtraLine2,
    cardTemplate: snapshot.tournamentCardTemplate ?? "A",
    backgroundType: snapshot.tournamentBackgroundType ?? (snapshot.image320Url?.trim() ? "image" : "theme"),
    themeType: snapshot.tournamentTheme ?? "dark",
  }));
  const dummySlideItems = [
    {
      snapshotId: "dummy-slide-1",
      title: "제2회 전국당구대회",
      subtitle: "2026.05.18(토) · 캐롬클럽 빌리어즈",
      statusBadge: "모집중",
      cardExtraLine1: "전국 오픈 · 클럽 리그",
      cardExtraLine2: "클럽 회원 및 게스트 참가 가능",
      cardTemplate: "A" as const,
      backgroundType: "image" as const,
      themeType: "dark" as const,
    },
    {
      snapshotId: "dummy-slide-2",
      title: "2026 캐롬 스프링컵",
      subtitle: "2026.06.01(일) · 강남구 K당구장",
      statusBadge: "마감임박",
      cardExtraLine1: "서울 지역 예선",
      cardExtraLine2: "예선 마감 임박 · 선착순 마감",
      cardTemplate: "B" as const,
      backgroundType: "theme" as const,
      themeType: "dark" as const,
    },
    {
      snapshotId: "dummy-slide-3",
      title: "클럽 내부 리그 3부",
      subtitle: "2026.05.25(토) · 캐롬클럽 빌리어즈",
      statusBadge: "대기자모집",
      cardExtraLine1: "주말 리그",
      cardExtraLine2: "대기 접수 중 · 취소 시 순번 연락",
      cardTemplate: "A" as const,
      backgroundType: "image" as const,
      themeType: "natural" as const,
    },
  ];
  const forcedMainSlideItems =
    liveSlideItems.length > 0 ? liveSlideItems : dummySlideItems.map((item) => ({ ...item }));

  const showSiteNoticeBar = siteNotice.enabled === true && siteNotice.text.trim().length > 0;

  return (
    <SiteShellFrame
      shellVariant="home"
      mainId="main-layout"
      prependMain={
        <>
      {previewMode ? (
        <Script id="site-preview-selection-bridge" strategy="afterInteractive">
          {`
            (() => {
              if (typeof window === "undefined") return;
              if (!window.parent || window.parent === window) return;
              const styleId = "site-preview-selection-style";
              if (!document.getElementById(styleId)) {
                const styleNode = document.createElement("style");
                styleNode.id = styleId;
                styleNode.textContent = ".site-preview-selected-section{outline:2px solid rgba(37,99,235,0.5)!important;outline-offset:1px;background:rgba(37,99,235,0.07)!important;}.site-preview-selected-block{outline:2px solid #2563eb!important;outline-offset:1px;background:rgba(37,99,235,0.12)!important;}";
                document.head.appendChild(styleNode);
              }

              const clearPreviewSelection = () => {
                document
                  .querySelectorAll(".site-preview-selected-block")
                  .forEach((node) => node.classList.remove("site-preview-selected-block"));
                document
                  .querySelectorAll(".site-preview-selected-section")
                  .forEach((node) => node.classList.remove("site-preview-selected-section"));
              };

              const applyPreviewSelection = (payload) => {
                clearPreviewSelection();
                if (payload.sectionId) {
                  document
                    .querySelectorAll('[data-section-id="' + payload.sectionId + '"]')
                    .forEach((node) => node.classList.add("site-preview-selected-section"));
                }
                if (payload.blockId) {
                  const blockNode = document.querySelector('[data-block-id="' + payload.blockId + '"]');
                  if (blockNode) {
                    blockNode.classList.add("site-preview-selected-block");
                  }
                }
              };

              document.addEventListener(
                "click",
                (event) => {
                  const target = event.target;
                  if (!(target instanceof Element)) return;
                  const host = target.closest("[data-block-id], [data-section-id]");
                  if (!host) return;
                  const blockHost = host.closest("[data-block-id]");
                  const sectionHost = blockHost ?? host.closest("[data-section-id]");
                  const sectionId = (sectionHost && sectionHost.getAttribute("data-section-id")) || null;
                  const blockId = (blockHost && blockHost.getAttribute("data-block-id")) || null;
                  event.preventDefault();
                  event.stopPropagation();
                  applyPreviewSelection({ sectionId, blockId });
                  window.parent.postMessage(
                    {
                      type: "site-preview-select",
                      sectionId,
                      blockId,
                    },
                    window.location.origin
                  );
                },
                true
              );

              window.addEventListener("message", (event) => {
                if (event.origin !== window.location.origin) return;
                const data = event.data;
                if (!data || data.type !== "site-preview-highlight") return;
                const sectionId = typeof data.sectionId === "string" && data.sectionId.trim() ? data.sectionId : null;
                const blockId = typeof data.blockId === "string" && data.blockId.trim() ? data.blockId : null;
                applyPreviewSelection({ sectionId, blockId });
              });
            })();
          `}
        </Script>
      ) : null}
        </>
      }
      brandTitle={<SiteMainLogo />}
    >
        <section id="main-content-group" className="v3-stack site-home-dark-main site-home-dark-main--stack">
          <section className="v3-stack site-home-slide-stack site-home-slide-stack--flush" style={{ gap: 0 }}>
            <section
              className="site-home-slide-anchor"
              data-section-id={tournamentSlideEntry?.sectionId ?? "section-tournament-forced"}
              data-block-id={tournamentSlideEntry?.block.id ?? "block-tournament-forced"}
              data-title-section-id={tournamentTitleEntry?.sectionId ?? tournamentSlideEntry?.sectionId}
              data-title-block-id={tournamentTitleEntry?.block.id}
            >
              <MainSceneSlideDeckClient
                items={forcedMainSlideItems}
                sectionLabel={tournamentTitleEntry?.block.data.text?.trim() || "진행중 대회"}
                siteNoticeText={showSiteNoticeBar ? siteNotice.text.trim() : undefined}
              />
            </section>
          </section>

          <section
            id="main-buttons"
            className="site-home-nav-grid"
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {fixedMainButtons.map((row) => {
              const tileStyle = {
                textDecoration: "none" as const,
                color: "inherit",
                textAlign: "center" as const,
                minHeight: "3.35rem",
              };
              const inner = (
                <>
                  <span className="site-home-nav-icon">
                    <SiteMainNavIcon variant={mainNavVariants[row.label]} />
                  </span>
                  <span className="site-home-nav-label">{row.label}</span>
                </>
              );
              return row.label === "주변당구장" ? (
                <VenuesDistanceNavLink
                  key={`fixed-main-nav-${row.label}`}
                  href={row.href}
                  className="site-home-nav-tile"
                  style={tileStyle}
                >
                  {inner}
                </VenuesDistanceNavLink>
              ) : (
                <Link key={`fixed-main-nav-${row.label}`} href={row.href} className="site-home-nav-tile" style={tileStyle}>
                  {inner}
                </Link>
              );
            })}
          </section>
          {dashboardHref ? (
            <Link href={dashboardHref} className="site-home-cta-primary">
              {dashboardLabel}
            </Link>
          ) : null}
        </section>

    </SiteShellFrame>
  );
}
