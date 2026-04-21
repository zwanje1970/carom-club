/**
 * 모바일 상위(하단) 메뉴 스와이프 순서 — 이 배열만 prev/next·인덱스·하단 네비의 근거로 쓴다.
 * (home → tournaments → venues → community → mypage)
 */

export type SiteRootSwipeNavKey = "home" | "tournaments" | "venues" | "community" | "mypage";

export type SiteRootSwipeNavItem = { key: SiteRootSwipeNavKey; href: string; label: string };

export const SITE_ROOT_SWIPE_NAV = [
  { key: "home", href: "/site", label: "홈" },
  { key: "tournaments", href: "/site/tournaments", label: "대회안내" },
  { key: "venues", href: "/site/venues", label: "당구장안내" },
  { key: "community", href: "/site/community", label: "커뮤니티" },
  { key: "mypage", href: "/site/mypage", label: "마이페이지" },
] as const satisfies readonly SiteRootSwipeNavItem[];

export const SITE_ROOT_SWIPE_HREFS = SITE_ROOT_SWIPE_NAV.map((x) => x.href) as readonly string[];

export function normalizeSiteRootPathname(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** 터치 처리 시점의 실제 URL(클라이언트) — React pathname과 어긋나면 잘못된 prev/next가 나올 수 있음 */
export function siteRootSwipePathnameNow(fallbackFromHook: string): string {
  if (typeof window !== "undefined" && typeof window.location?.pathname === "string") {
    return window.location.pathname;
  }
  return fallbackFromHook;
}

/**
 * pathname → 상위 메뉴 인덱스.
 * `/site`는 home 전용. `/site/tournaments/...` 등은 tournaments 허브로만 잡히도록 `/site` 단독 매칭을 나중에 한다.
 */
export function siteRootSwipeIndex(pathname: string): number {
  const p = normalizeSiteRootPathname(pathname);
  const communityHref = "/site/community";
  if (p === communityHref || p.startsWith(`${communityHref}/`)) {
    return SITE_ROOT_SWIPE_NAV.findIndex((x) => x.key === "community");
  }

  const nonHome = SITE_ROOT_SWIPE_NAV.filter((x) => x.key !== "home");
  nonHome.sort((a, b) => b.href.length - a.href.length);
  for (const hub of nonHome) {
    if (p === hub.href || p.startsWith(`${hub.href}/`)) {
      return SITE_ROOT_SWIPE_NAV.findIndex((x) => x.key === hub.key);
    }
  }

  if (p === "/" || p === "/site") {
    return SITE_ROOT_SWIPE_NAV.findIndex((x) => x.key === "home");
  }
  return -1;
}

export function isSiteRootSwipePath(pathname: string): boolean {
  return siteRootSwipeIndex(pathname) >= 0;
}

/** 커뮤니티 게시판 목록 허브만(전체·단일 게시판 탭). 상세·쓰기 등은 false */
export function isCommunityBoardListHubPath(pathname: string): boolean {
  const p = normalizeSiteRootPathname(pathname);
  if (p === "/site/community") return true;
  const m = /^\/site\/community\/([^/]+)$/.exec(p);
  if (!m?.[1]) return false;
  const seg = m[1];
  if (seg === "write" || seg === "preview") return false;
  return true;
}

export function siteRootSwipeHrefAt(index: number): string | null {
  if (index < 0 || index >= SITE_ROOT_SWIPE_NAV.length) return null;
  return SITE_ROOT_SWIPE_NAV[index]!.href;
}
