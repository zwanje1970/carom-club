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
  mdiFormatListBulleted,
  mdiMessageQuestion,
  mdiCog,
  mdiSitemap,
  mdiBrushVariant,
} from "@mdi/js";
import type { MenuAsideItem } from "./_interfaces";

const CLIENT_CHILD_HREFS = ["/admin/venues", "/admin/client-applications", "/admin/fee-ledger"] as const;
/** 사이트관리 하위(사이드바 그룹 펼침용) */
export const SITE_CHILD_HREFS = [
  "/admin/page-builder",
  "/admin/site/copy",
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
    { href: "/admin/inquiries", label: L("menu.inquiries", "문의관리"), icon: mdiMessageQuestion },
    {
      label: L("menu.siteManagement", "사이트관리"),
      icon: mdiCog,
      menu: [
        { href: "/admin/page-builder", label: "페이지 빌더", icon: mdiSitemap },
        { href: "/admin/site/copy", label: "문구 관리", icon: mdiFormatListBulleted },
        { href: "/admin/site/settings", label: "헤더 / 푸터 / 인트로 관리", icon: mdiCashMultiple },
        { href: "/admin/site/color-theme", label: "색상 / 테마", icon: mdiBrushVariant },
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
  if (!pathname || pathname === "/admin") return -1;

  if (CLIENT_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 2;
  if (pathname === "/admin/members" || pathname.startsWith("/admin/members/")) return 3;
  if (pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/")) return 4;
  if (SITE_CHILD_HREFS.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return 5;

  return -1;
}
