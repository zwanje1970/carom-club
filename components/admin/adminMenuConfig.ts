/**
 * 관리자 사이드바 메뉴 (업무 흐름 기준, 단일 진입점)
 * - copy: 플랫폼 설정의 메뉴/문구 키로 덮어쓰기 가능
 */
import {
  mdiViewDashboard,
  mdiTrophy,
  mdiOfficeBuilding,
  mdiClipboardCheck,
  mdiCashMultiple,
  mdiAccountMultiple,
  mdiCardText,
  mdiFormatListBulleted,
  mdiMessageQuestion,
  mdiCog,
} from "@mdi/js";
import type { MenuAsideItem } from "./_interfaces";
import { PLATFORM_CARD_TEMPLATES_MENU_LABEL } from "@/lib/platform-card-templates";

const CLIENT_CHILD_HREFS = ["/admin/venues", "/admin/client-applications", "/admin/fee-ledger"] as const;
/** 사이트관리 진입(사이드바 활성화용) */
export const SITE_CHILD_HREFS = ["/admin/site", "/admin/site/page-builder-new"] as const;
const PLATFORM_SITE_CHILD_HREFS = [
  "/admin/site",
  "/admin/site/page-builder-new",
  "/admin/site/page-builder-next",
  "/admin/site/page-builder-v2",
  "/admin/site/content",
  "/admin/site/community",
  "/admin/site/copy",
  "/admin/site/header",
  "/admin/site/hero",
  "/admin/site/footer",
  "/admin/site/intro",
  "/admin/site/card-style",
  "/admin/site/settings",
  "/admin/site/color-theme",
] as const;

/** 현재 pathname이 해당 그룹에 속하는지 */
export function isGroupActive(pathname: string, hrefs: string[]): boolean {
  if (!pathname || pathname === "/admin") return false;
  return hrefs.some((h) => pathname === h || (h !== "/admin" && pathname.startsWith(h + "/")));
}

/**
 * 사이드바 메뉴 구조
 * 순서: 대시보드 → 대회관리 → 클라이언트 관리 → 회원·권한 → 문의 → 사이트관리
 */
export function getAdminMenuAside(copy?: Record<string, string> | undefined): MenuAsideItem[] {
  const L = (key: string, fallback: string) =>
    (copy?.[key] && String(copy[key]).trim()) || fallback;

  return [
    { href: "/admin/dashboard", label: L("menu.dashboard", "대시보드"), icon: mdiViewDashboard },
    { href: "/admin/tournaments", label: L("menu.tournaments", "대회관리"), icon: mdiTrophy },
    {
      label: L("menu.clientSection", "클라이언트 관리"),
      icon: mdiOfficeBuilding,
      menu: [
        { href: "/admin/venues", label: L("menu.venueList", "클라이언트 목록"), icon: mdiFormatListBulleted },
        { href: "/admin/client-applications", label: L("menu.clientApplications", "신청 관리"), icon: mdiClipboardCheck },
        { href: "/admin/fee-ledger", label: L("menu.feeLedger", "정산"), icon: mdiCashMultiple },
      ],
    },
    { href: "/admin/members", label: L("menu.membersUnified", "회원·권한 관리"), icon: mdiAccountMultiple },
    { href: "/admin/inquiries", label: L("menu.inquiries", "문의관리"), icon: mdiMessageQuestion },
    { href: "/admin/site", label: L("menu.siteManagement", "사이트관리"), icon: mdiCog },
  ];
}

/**
 * 플랫폼 운영 전용 사이드바 메뉴 구조
 * 순서: 플랫폼 대시보드 → 클라이언트 관리 → 승인 관리 → 권한 관리 → 정산/결제 → 메인용 게시카드 → 사이트관리
 */
export function getPlatformMenuAside(copy?: Record<string, string> | undefined): MenuAsideItem[] {
  const L = (key: string, fallback: string) =>
    (copy?.[key] && String(copy[key]).trim()) || fallback;

  return [
    { href: "/admin/platform", label: L("menu.platformDashboard", "플랫폼 대시보드"), icon: mdiViewDashboard },
    { href: "/admin/venues", label: L("menu.venueList", "클라이언트 관리"), icon: mdiOfficeBuilding },
    { href: "/admin/client-applications", label: L("menu.clientApplications", "승인 관리"), icon: mdiClipboardCheck },
    { href: "/admin/members", label: "회원·권한 관리", icon: mdiAccountMultiple },
    { href: "/admin/fee-ledger", label: L("menu.feeLedger", "정산/결제"), icon: mdiCashMultiple },
    { href: "/admin/platform/card-templates", label: L("menu.platformCardTemplates", PLATFORM_CARD_TEMPLATES_MENU_LABEL), icon: mdiCardText },
    {
      label: L("menu.siteManagement", "사이트관리"),
      icon: mdiCog,
      menu: [
        { href: "/admin/site", label: L("menu.siteManagementHome", "사이트관리 홈") },
        { href: "/admin/site/page-builder-new", label: L("menu.pageBuilder", "페이지빌더") },
        { href: "/admin/site/content", label: L("menu.contentManagement", "콘텐츠 관리") },
        { href: "/admin/site/community", label: L("menu.communityManagement", "커뮤니티 관리") },
        { href: "/admin/site/copy", label: L("menu.copyManagement", "문구 관리") },
        { href: "/admin/site/header", label: L("menu.headerManagement", "헤더 관리") },
        { href: "/admin/site/hero", label: L("menu.heroEditor", "히어로 편집") },
        { href: "/admin/site/footer", label: L("menu.footerEditor", "푸터 편집") },
        { href: "/admin/site/intro", label: L("menu.introSettings", "인트로 설정") },
        { href: "/admin/site/card-style", label: L("menu.cardStyleManagement", "카드 스타일 관리") },
        { href: "/admin/site/settings", label: L("menu.siteSettings", "사이트 설정") },
        { href: "/admin/site/color-theme", label: L("menu.colorTheme", "색상 테마") },
      ],
    },
  ];
}

/**
 * pathname 기준으로 펼칠 그룹 인덱스 (getAdminMenuAside 반환 배열의 인덱스)
 * 0=대시보드, 1=대회관리, 2=클라이언트 관리, 3=회원·권한, 4=문의, 5=사이트관리
 * -1: 펼침 없음(대시보드·대회관리 등 단일 링크이거나 해당 없음)
 */
export function getExpandedGroupIndex(pathname: string): number {
  if (!pathname || pathname === "/admin" || pathname === "/admin/dashboard") return -1;

  if (CLIENT_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 2;
  if (pathname === "/admin/members" || pathname.startsWith("/admin/members/")) return 3;
  if (pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/")) return 4;
  return -1;
}

export function getPlatformExpandedGroupIndex(_pathname: string): number {
  const pathname = _pathname ?? "";
  if (
    pathname === "/admin/site" ||
    PLATFORM_SITE_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))
  ) {
    return 6;
  }
  return -1;
}
