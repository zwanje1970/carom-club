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
  mdiFormatSection,
  mdiFormatListBulleted,
  mdiWindowRestore,
  mdiViewCarousel,
  mdiMessageQuestion,
  mdiCog,
  mdiPageLayoutBody,
  mdiForum,
  mdiPalette,
  mdiToggleSwitch,
  mdiSitemap,
  mdiBrushVariant,
} from "@mdi/js";
import type { MenuAsideItem } from "./_interfaces";

const CLIENT_CHILD_HREFS = ["/admin/venues", "/admin/client-applications", "/admin/fee-ledger"] as const;
const CONTENT_CHILD_HREFS = [
  "/admin/page-builder",
  "/admin/page-sections",
  "/admin/popups",
  "/admin/notice-bars",
] as const;
/** 사이트관리 하위(사이드바 그룹 펼침용) */
export const SITE_CHILD_HREFS = [
  "/admin/site",
  "/admin/site/home",
  "/admin/site/community",
  "/admin/site/copy",
  "/admin/site/settings",
  "/admin/site/features",
  "/admin/site/main",
  "/admin/site/hero",
  "/admin/site/footer",
  "/admin/site/design",
  "/admin/site/color-theme",
  "/admin/settings/platform-billing",
] as const;

/** 현재 pathname이 해당 그룹에 속하는지 */
export function isGroupActive(pathname: string, hrefs: string[]): boolean {
  if (!pathname || pathname === "/admin") return false;
  return hrefs.some((h) => pathname === h || (h !== "/admin" && pathname.startsWith(h + "/")));
}

/**
 * 사이드바 메뉴 구조
 * 순서: 대시보드 → 대회관리 → 클라이언트 관리 → 회원·권한 → 콘텐츠 → 문의 → 설정(/admin/site)
 */
export function getAdminMenuAside(copy?: Record<string, string> | undefined): MenuAsideItem[] {
  const L = (key: string, fallback: string) =>
    (copy?.[key] && String(copy[key]).trim()) || fallback;

  return [
    { href: "/admin", label: L("menu.dashboard", "대시보드"), icon: mdiViewDashboard },
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
    {
      label: L("menu.content", "콘텐츠 관리"),
      icon: mdiFormatSection,
      menu: [
        { href: "/admin/page-builder", label: L("menu.pageBuilder", "페이지 빌더 (구조)"), icon: mdiSitemap },
        { href: "/admin/page-sections", label: L("menu.pageSections", "콘텐츠 편집 (CMS)"), icon: mdiFormatListBulleted },
        { href: "/admin/popups", label: L("menu.popups", "팝업 관리"), icon: mdiWindowRestore },
        { href: "/admin/notice-bars", label: L("menu.noticeBars", "공지 배너 관리"), icon: mdiViewCarousel },
      ],
    },
    { href: "/admin/inquiries", label: L("menu.inquiries", "문의관리"), icon: mdiMessageQuestion },
    {
      label: L("menu.siteManagement", "사이트관리"),
      icon: mdiCog,
      menu: [
        { href: "/admin/site", label: "사이트관리 홈", icon: mdiViewDashboard },
        { href: "/admin/site/home", label: "홈 화면 설정", icon: mdiPageLayoutBody },
        { href: "/admin/site/community", label: "커뮤니티 설정", icon: mdiForum },
        { href: "/admin/site/copy", label: "문구 관리", icon: mdiFormatListBulleted },
        { href: "/admin/site/settings", label: "디자인/브랜드 설정", icon: mdiPalette },
        { href: "/admin/site/color-theme", label: "색상 테마", icon: mdiBrushVariant },
        { href: "/admin/site/features", label: "기능 설정", icon: mdiToggleSwitch },
        { href: "/admin/settings/platform-billing", label: "플랫폼 빌링 설정", icon: mdiCashMultiple },
      ],
    },
  ];
}

/**
 * pathname 기준으로 펼칠 그룹 인덱스 (getAdminMenuAside 반환 배열의 인덱스)
 * 0=대시보드, 1=대회관리, 2=클라이언트 관리, 3=회원·권한, 4=콘텐츠, 5=문의, 6=사이트관리
 * -1: 펼침 없음(대시보드·대회관리 등 단일 링크이거나 해당 없음)
 */
export function getExpandedGroupIndex(pathname: string): number {
  if (!pathname || pathname === "/admin") return -1;

  if (CLIENT_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 2;
  if (pathname === "/admin/members" || pathname.startsWith("/admin/members/")) return 3;
  if (CONTENT_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 4;
  if (pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/")) return 5;
  if (SITE_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 6;
  if (pathname === "/admin/settings" || pathname.startsWith("/admin/settings/")) return 6;

  return -1;
}
