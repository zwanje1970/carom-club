/**
 * 관리자 메뉴 구조 (고정)
 * - 상위 5개: 대시보드, 사이트관리, 회원관리, 클라이언트관리, 운영관리
 * - 관리 대상 기준 분류, 동일 기능 중복 없음
 */
import {
  mdiViewDashboard,
  mdiCog,
  mdiAccountMultiple,
  mdiOfficeBuilding,
  mdiClipboardList,
  mdiFormatSection,
  mdiPageLayoutBody,
  mdiViewModule,
  mdiViewCarousel,
  mdiWindowRestore,
  mdiFormatListBulleted,
  mdiAccountCog,
  mdiShieldAlert,
  mdiMessageQuestion,
  mdiForum,
  mdiHistory,
  mdiClipboardCheck,
  mdiFormatListGroup,
  mdiStarCircle,
  mdiCalendarCheck,
  mdiSchool,
  mdiBullhorn,
  mdiBug,
  mdiLightbulb,
  mdiAlertCircle,
  mdiNotebookEdit,
  mdiBell,
} from "@mdi/js";
import type { MenuAsideItem } from "./_interfaces";

/** 사이트관리 하위 */
const SITE_ITEMS: MenuAsideItem[] = [
  { href: "/admin/site/main", label: "메인페이지 관리", icon: mdiPageLayoutBody },
  {
    label: "섹션/컴포넌트 관리",
    icon: mdiFormatSection,
    menu: [
      { href: "/admin/page-sections", label: "페이지 섹션", icon: mdiFormatListBulleted },
      { href: "/admin/site/components", label: "컴포넌트", icon: mdiViewModule },
    ],
  },
  { href: "/admin/settings/featured-content", label: "배너/노출 관리", icon: mdiViewCarousel },
  {
    label: "팝업/공지바 관리",
    icon: mdiWindowRestore,
    menu: [
      { href: "/admin/popups", label: "팝업", icon: mdiWindowRestore },
      { href: "/admin/notice-bars", label: "공지바", icon: mdiViewCarousel },
    ],
  },
];

/** 회원관리 하위 (신고는 운영관리에서만) */
const MEMBER_ITEMS: MenuAsideItem[] = [
  { href: "/admin/members", label: "회원 목록", icon: mdiFormatListBulleted },
  { href: "/admin/members", label: "회원 상세", icon: mdiAccountMultiple },
  { href: "/admin/members", label: "회원 권한/상태 관리", icon: mdiAccountCog },
  { href: "/admin/members", label: "회원 제재 관리", icon: mdiShieldAlert },
  { href: "/admin/inquiries", label: "문의/건의사항", icon: mdiMessageQuestion },
  { href: "/admin/community/posts", label: "커뮤니티 글 관리", icon: mdiForum },
  { href: "/admin/members/activity", label: "활동 로그", icon: mdiHistory },
];

/** 클라이언트관리 하위 */
const CLIENT_ITEMS: MenuAsideItem[] = [
  { href: "/admin/client-applications", label: "클라이언트 신청 관리", icon: mdiClipboardCheck },
  { href: "/admin/venues", label: "클라이언트 목록", icon: mdiFormatListBulleted },
  { href: "/admin/venues", label: "클라이언트 상세", icon: mdiOfficeBuilding },
  { href: "/admin/pricing-plans", label: "등급/연회원 관리", icon: mdiStarCircle },
  { href: "/admin/venues", label: "노출/기간 관리", icon: mdiViewCarousel },
  { href: "/admin/settings/featured-content", label: "메인 노출 ON/OFF", icon: mdiStarCircle },
  { href: "/admin/tournaments", label: "대회 운영 현황", icon: mdiCalendarCheck },
  { href: "/admin/venues", label: "레슨 운영 현황", icon: mdiSchool },
];

/** 운영관리 하위 (신고 처리 = 여기만) */
const OPERATION_ITEMS: MenuAsideItem[] = [
  { href: "/admin/settings/notices", label: "공지사항 관리", icon: mdiBullhorn },
  { href: "/admin/inquiries", label: "오류제보 관리", icon: mdiBug },
  { href: "/admin/inquiries", label: "기능개선 요청", icon: mdiLightbulb },
  { href: "/community/admin/reports", label: "신고 처리", icon: mdiAlertCircle },
  { href: "/admin/settings/admin-logs", label: "운영 로그", icon: mdiNotebookEdit },
  { href: "/admin/settings/notifications", label: "알림 관리", icon: mdiBell },
];

function flattenHrefs(items: MenuAsideItem[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it.href) out.push(it.href);
    if (it.menu) out.push(...flattenHrefs(it.menu));
  }
  return out;
}

/** 현재 pathname이 해당 그룹에 속하는지 */
export function isGroupActive(pathname: string, hrefs: string[]): boolean {
  if (!pathname || pathname === "/admin") return false;
  return hrefs.some((h) => pathname === h || (h !== "/admin" && pathname.startsWith(h + "/")));
}

/** 상위 5개 + 하위 메뉴 (고정) */
export function getAdminMenuAside(copy?: Record<string, string>): MenuAsideItem[] {
  const L = (key: string, fallback: string) =>
    (copy?.[key] && String(copy[key]).trim()) || fallback;

  return [
    { href: "/admin", label: L("menu.dashboard", "대시보드"), icon: mdiViewDashboard },
    {
      label: L("menu.site", "사이트관리"),
      icon: mdiCog,
      menu: SITE_ITEMS,
    },
    {
      label: L("menu.members", "회원관리"),
      icon: mdiAccountMultiple,
      menu: MEMBER_ITEMS,
    },
    {
      label: L("menu.venues", "클라이언트관리"),
      icon: mdiOfficeBuilding,
      menu: CLIENT_ITEMS,
    },
    {
      label: L("menu.operation", "운영관리"),
      icon: mdiClipboardList,
      menu: OPERATION_ITEMS,
    },
  ];
}

/** pathname 기준으로 펼칠 상위 메뉴 인덱스 (0=대시보드, 1=사이트, 2=회원, 3=클라이언트, 4=운영) */
export function getExpandedGroupIndex(pathname: string): number {
  if (!pathname || pathname === "/admin") return -1;
  const groups = [["/admin"], flattenHrefs(SITE_ITEMS), flattenHrefs(MEMBER_ITEMS), flattenHrefs(CLIENT_ITEMS), flattenHrefs(OPERATION_ITEMS)];
  for (let i = 1; i < groups.length; i++) {
    if (groups[i].some((h) => pathname === h || (h !== "/admin" && pathname.startsWith(h + "/"))))
      return i;
  }
  return -1;
}
