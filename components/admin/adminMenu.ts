/**
 * 관리자 사이드/상단 메뉴 (레거시·문구 기본값)
 * 사이드바 실제 구조는 adminMenuConfig.ts 의 getAdminMenuAside 를 사용합니다.
 */
import {
  mdiViewDashboard,
  mdiTrophy,
  mdiAccountMultiple,
  mdiMessageQuestion,
  mdiOfficeBuilding,
  mdiClipboardCheck,
  mdiCog,
  mdiLogout,
  mdiHome,
  mdiFormatSection,
  mdiWindowRestore,
  mdiViewCarousel,
  mdiFormatListBulleted,
  mdiCashMultiple,
  mdiSitemap,
} from "@mdi/js";
import type { MenuAsideItem, MenuNavBarItem } from "./_interfaces";

const defaultCopy: Record<string, string> = {
  "menu.home": "메인으로",
  "menu.dashboard": "대시보드",
  "menu.content": "콘텐츠 관리",
  "menu.pageSections": "콘텐츠 편집 (CMS)",
  "menu.pageBuilder": "페이지 빌더 (구조)",
  "menu.popups": "팝업 관리",
  "menu.noticeBars": "공지 배너 관리",
  "menu.tournaments": "대회관리",
  "menu.members": "회원·권한 관리",
  "menu.membersUnified": "회원·권한 관리",
  "menu.inquiries": "문의관리",
  "menu.clientSection": "클라이언트 관리",
  "menu.venueList": "클라이언트 목록",
  "menu.feeLedger": "정산",
  "menu.clientApplications": "신청 관리",
  "menu.settings": "설정",
  "nav.myInfo": "내 정보",
  "nav.settings": "설정",
  "nav.home": "메인으로",
  "nav.logout": "로그아웃",
  "footer.copyright": "CAROM.CLUB 관리자",
};

function L(copy: Record<string, string> | undefined, key: string): string {
  const v = copy?.[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : (defaultCopy[key] ?? key);
}

/** @deprecated getAdminMenuAside(adminMenuConfig) 사용 권장 — 동일 업무 흐름 구조로 정렬됨 */
export function getMenuAside(copy?: Record<string, string>): MenuAsideItem[] {
  return [
    { href: "/admin", label: L(copy, "menu.dashboard"), icon: mdiViewDashboard },
    { href: "/admin/tournaments", label: L(copy, "menu.tournaments"), icon: mdiTrophy },
    {
      label: L(copy, "menu.clientSection"),
      icon: mdiOfficeBuilding,
      menu: [
        { href: "/admin/venues", label: L(copy, "menu.venueList"), icon: mdiFormatListBulleted },
        { href: "/admin/client-applications", label: L(copy, "menu.clientApplications"), icon: mdiClipboardCheck },
        { href: "/admin/fee-ledger", label: L(copy, "menu.feeLedger"), icon: mdiCashMultiple },
      ],
    },
    { href: "/admin/members", label: L(copy, "menu.membersUnified"), icon: mdiAccountMultiple },
    {
      label: L(copy, "menu.content"),
      icon: mdiFormatSection,
      menu: [
        { href: "/admin/page-builder", label: L(copy, "menu.pageBuilder"), icon: mdiSitemap },
        { href: "/admin/page-sections", label: L(copy, "menu.pageSections"), icon: mdiFormatListBulleted },
        { href: "/admin/popups", label: L(copy, "menu.popups"), icon: mdiWindowRestore },
        { href: "/admin/notice-bars", label: L(copy, "menu.noticeBars"), icon: mdiViewCarousel },
      ],
    },
    { href: "/admin/inquiries", label: L(copy, "menu.inquiries"), icon: mdiMessageQuestion },
    { href: "/admin/site", label: L(copy, "menu.settings"), icon: mdiCog },
  ];
}

export const menuAside = getMenuAside();

export function buildMenuNavBar(_userName?: string, _copy?: Record<string, string>): MenuNavBarItem[] {
  return [];
}
