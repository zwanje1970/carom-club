/**
 * 관리자 사이드/상단 메뉴 (기존 app/admin 라우트 기준)
 * copy: 플랫폼 관리자 > 설정 > 메뉴/문구에서 수정한 값 (없으면 기본값 사용)
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
  mdiAccountCog,
  mdiCashMultiple,
} from "@mdi/js";
import type { MenuAsideItem, MenuNavBarItem } from "./_interfaces";

const defaultCopy: Record<string, string> = {
  "menu.home": "메인으로",
  "menu.dashboard": "대시보드",
  "menu.content": "콘텐츠 관리",
  "menu.pageSections": "페이지 섹션 관리",
  "menu.popups": "팝업 관리",
  "menu.noticeBars": "공지 배너 관리",
  "menu.tournaments": "대회관리",
  "menu.tournamentList": "대회 목록",
  "menu.tournamentNew": "대회 생성",
  "menu.participants": "참가 신청 관리",
  "menu.brackets": "대진표관리",
  "menu.members": "회원관리",
  "menu.memberList": "회원 목록",
  "menu.memberRoles": "권한 관리",
  "menu.inquiries": "문의관리",
  "menu.venues": "클라이언트 관리",
  "menu.venueList": "클라이언트 목록",
  "menu.feeLedger": "회비 장부",
  "menu.clientApplications": "클라이언트 신규신청",
  "menu.billing": "요금 정책",
  "menu.features": "기능 목록",
  "menu.pricingPlans": "요금제/상품",
  "menu.listingProducts": "등록상품 정책",
  "menu.settings": "설정",
  "nav.myInfo": "내 정보",
  "nav.settings": "설정",
  "nav.home": "메인으로",
  "nav.logout": "로그아웃",
  "footer.copyright": "CAROM.CLUB 관리자",
};

function L(copy: Record<string, string> | undefined, key: string): string {
  const v = copy?.[key];
  return (typeof v === "string" && v.trim() !== "") ? v.trim() : (defaultCopy[key] ?? key);
}

export function getMenuAside(copy?: Record<string, string>): MenuAsideItem[] {
  return [
    { href: "/admin", label: L(copy, "menu.dashboard"), icon: mdiViewDashboard },
    {
      label: L(copy, "menu.content"),
      icon: mdiFormatSection,
      menu: [
        { href: "/admin/page-sections", label: L(copy, "menu.pageSections"), icon: mdiFormatListBulleted, hideOnMobile: true },
        { href: "/admin/popups", label: L(copy, "menu.popups"), icon: mdiWindowRestore },
        { href: "/admin/notice-bars", label: L(copy, "menu.noticeBars"), icon: mdiViewCarousel },
      ],
    },
    { href: "/admin/tournaments", label: "대회 현황", icon: mdiTrophy },
    {
      label: L(copy, "menu.venues"),
      icon: mdiOfficeBuilding,
      menu: [
        { href: "/admin/venues", label: L(copy, "menu.venueList"), icon: mdiFormatListBulleted },
        { href: "/admin/fee-ledger", label: L(copy, "menu.feeLedger"), icon: mdiCashMultiple },
        { href: "/admin/client-applications", label: L(copy, "menu.clientApplications"), icon: mdiClipboardCheck },
      ],
    },
    {
      label: L(copy, "menu.members"),
      icon: mdiAccountMultiple,
      menu: [
        { href: "/admin/members", label: L(copy, "menu.memberList"), icon: mdiFormatListBulleted },
        { href: "/admin/members", label: L(copy, "menu.memberRoles"), icon: mdiAccountCog },
      ],
    },
    { href: "/admin/inquiries", label: L(copy, "menu.inquiries"), icon: mdiMessageQuestion },
    {
      label: L(copy, "menu.billing"),
      icon: mdiCashMultiple,
      menu: [
        { href: "/admin/features", label: L(copy, "menu.features"), icon: mdiFormatListBulleted },
        { href: "/admin/pricing-plans", label: L(copy, "menu.pricingPlans"), icon: mdiFormatListBulleted },
        { href: "/admin/listing-products", label: L(copy, "menu.listingProducts"), icon: mdiFormatListBulleted },
      ],
    },
    { href: "/admin/settings", label: L(copy, "menu.settings"), icon: mdiCog },
  ];
}

/** @deprecated getMenuAside(copy) 사용 권장 */
export const menuAside = getMenuAside();

/** 상단 오른쪽 네비게이션 메뉴. 관리자 정보 아이콘 제거됨(관리자 정보 수정은 설정 메뉴에서) */
export function buildMenuNavBar(_userName?: string, _copy?: Record<string, string>): MenuNavBarItem[] {
  return [];
}
