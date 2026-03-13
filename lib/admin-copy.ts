/**
 * 플랫폼 관리자 메뉴명·문구 커스텀
 * - 기본값은 아래 DEFAULT_ADMIN_COPY
 * - DB AdminCopy 테이블에 저장된 값으로 덮어씀
 */

import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 편집 가능한 메뉴/문구 키와 기본값 (라벨 설정 페이지에서 표시 순서·그룹용) */
export const DEFAULT_ADMIN_COPY: Record<string, string> = {
  // 사이드 메뉴
  "menu.home": "메인으로",
  "menu.dashboard": "대시보드",
  "menu.tournaments": "대회관리",
  "menu.participants": "참가자관리",
  "menu.brackets": "대진표관리",
  "menu.members": "회원관리",
  "menu.inquiries": "문의관리",
  "menu.venues": "클라이언트 관리",
  "menu.venueList": "클라이언트 목록",
  "menu.clientApplications": "클라이언트 신규신청",
  "menu.settings": "설정",
  // 상단 유저 메뉴
  "nav.myInfo": "내 정보",
  "nav.settings": "설정",
  "nav.home": "메인으로",
  "nav.logout": "로그아웃",
  // 공통
  "app.title": "CAROM.CLUB 관리자",
  "footer.copyright": "CAROM.CLUB 관리자",
  // 설정 메뉴
  "settings.menu.site": "사이트 설정",
  "settings.menu.notifications": "알림 설정",
  "settings.menu.integration": "연동 설정",
  "settings.menu.labels": "메뉴/문구",

  // ----- 사이트 안내/설명 (메인·대회·당구장·커뮤니티 등) -----
  "site.hero.tagline": "당구장 홍보 · 대회 신청",
  "site.hero.titleText": "CAROM.CLUB",
  "site.hero.subtitleText": "당구 대회와 커뮤니티를 한곳에서.",
  "site.hero.descriptionText": "",
  "site.hero.btnTournaments": "진행중 대회 보기",
  "site.hero.btnApply": "대회 참가 신청",
  "site.hero.taglineFont": "",
  "site.hero.taglineSize": "",
  "site.hero.taglineColor": "",
  "site.hero.taglineBold": "",
  "site.hero.taglineItalic": "",
  "site.hero.taglineUnderline": "",
  "site.hero.taglineAlign": "",
  "site.hero.titleFont": "",
  "site.hero.titleSize": "",
  "site.hero.titleColor": "",
  "site.hero.titleBold": "",
  "site.hero.titleItalic": "",
  "site.hero.titleUnderline": "",
  "site.hero.titleAlign": "",
  "site.hero.subtitleFont": "",
  "site.hero.subtitleSize": "",
  "site.hero.subtitleColor": "",
  "site.hero.subtitleBold": "",
  "site.hero.subtitleItalic": "",
  "site.hero.subtitleUnderline": "",
  "site.hero.subtitleAlign": "",
  "site.hero.taglineLineHeight": "",
  "site.hero.titleLineHeight": "",
  "site.hero.subtitleLineHeight": "",
  "site.hero.titleHtml": "",
  "site.hero.btnPosition": "below",
  "site.hero.btn1Size": "md",
  "site.hero.btn2Size": "md",
  "site.hero.btn1InternalPage": "tournaments",
  "site.hero.btn2InternalPage": "tournaments",
  "site.home.tournaments.title": "진행중 대회",
  "site.home.tournaments.subtitle": "참가 신청 가능한 대회를 확인하세요.",
  "site.home.tournaments.subtitleEmpty": "곧 새로운 대회가 올라올 예정입니다.",
  "site.home.tournaments.empty": "등록된 대회가 없습니다.",
  "site.home.tournaments.btnList": "대회 목록 보기",
  "site.home.tournaments.btnViewAll": "전체 보기 →",
  "site.home.tournaments.btnJoin": "참가하기",
  "site.home.venues.title": "당구장 소개",
  "site.home.venues.subtitle": "제휴 당구장을 소개합니다.",
  "site.home.venues.subtitleWithList": "대표 구장을 만나보세요.",
  "site.home.venues.empty": "등록된 당구장이 없습니다.",
  "site.home.venues.btnViewAll": "전체 보기 →",
  "site.home.community.title": "공지 · 커뮤니티",
  "site.home.community.subtitle": "소식과 이야기를 나눕니다.",
  "site.home.community.notice.title": "공지사항",
  "site.home.community.notice.desc": "대회 및 사이트 공지를 확인하세요.",
  "site.home.community.community.title": "커뮤니티",
  "site.home.community.community.desc": "당구 이야기를 나눠보세요.",
  "site.home.quickApply.title": "빠른 참가 신청",
  "site.home.quickApply.desc": "대회를 선택한 뒤 참가 신청 탭에서 입금자명과 참가요건 동의 후 신청할 수 있습니다.",
  "site.home.quickApply.btnApply": "대회 선택하고 참가하기",
  "site.home.quickApply.btnLogin": "로그인",
  "site.home.location.title": "위치 안내",
  "site.home.location.subtitle": "당구장별 오시는 길은 당구장 소개에서 확인하세요.",
  "site.home.location.body": "대표 당구장의 주소와 지도는 각 당구장 상세 페이지에서 확인할 수 있습니다.",
  "site.home.location.hint": "당구장 소개 카드에서 원하는 구장을 선택해 주세요.",
  "site.footer.tagline": "캐롬클럽 · 당구장 홍보 · 대회 신청",
  "site.tournaments.title": "대회 목록",
  "site.tournaments.subtitle": "진행 예정 및 진행 중인 당구 대회입니다.",
  "site.tournaments.empty": "등록된 대회가 없습니다.",
  "site.tournaments.emptyHint": "곧 새로운 대회가 올라올 예정입니다.",
  "site.venues.title": "당구장 소개",
  "site.venues.subtitle": "제휴 당구장을 소개합니다.",
  "site.venues.empty": "등록된 당구장이 없습니다.",
  "site.community.title": "커뮤니티",
  "site.community.subtitle": "소식과 이야기를 나눕니다.",
  "site.tournamentDetail.tabInfo": "대회 안내",
  "site.tournamentDetail.infoEmpty": "안내 내용이 없습니다.",
};

const COPY_KEYS = Object.keys(DEFAULT_ADMIN_COPY) as (keyof typeof DEFAULT_ADMIN_COPY)[];

export type AdminCopyKey = keyof typeof DEFAULT_ADMIN_COPY;

/** DB에서 커스텀 값 조회 후 기본값과 병합 */
export async function getAdminCopy(): Promise<Record<string, string>> {
  const base = { ...DEFAULT_ADMIN_COPY };
  if (!isDatabaseConfigured()) return base;
  try {
    const rows = await prisma.adminCopy.findMany();
    for (const row of rows) {
      if (COPY_KEYS.includes(row.key as AdminCopyKey)) {
        base[row.key] = row.value;
      }
    }
    return base;
  } catch {
    return base;
  }
}

/** 특정 키 값만 (키 없으면 기본값) */
export function getCopyValue(copy: Record<string, string>, key: AdminCopyKey): string {
  return copy[key] ?? DEFAULT_ADMIN_COPY[key] ?? key;
}

/** 여러 키-값 저장 (Prisma upsert로 SQLite/PostgreSQL 공통) */
export async function updateAdminCopy(updates: Record<string, string>): Promise<void> {
  if (!isDatabaseConfigured()) return;
  for (const key of Object.keys(updates)) {
    if (!COPY_KEYS.includes(key)) continue;
    const value = updates[key]?.trim() ?? "";
    const finalValue = value || (DEFAULT_ADMIN_COPY[key] ?? key);
    try {
      await prisma.adminCopy.upsert({
        where: { key },
        create: { key, value: finalValue },
        update: { value: finalValue },
      });
    } catch (e) {
      console.error("[admin-copy] upsert error for key:", key, e);
      throw e;
    }
  }
}

/** 설정 페이지에서 그룹별 키 목록 */
export const ADMIN_COPY_GROUPS: { group: string; keys: (keyof typeof DEFAULT_ADMIN_COPY)[] }[] = [
  { group: "사이드 메뉴", keys: ["menu.home", "menu.dashboard", "menu.tournaments", "menu.participants", "menu.brackets", "menu.members", "menu.inquiries", "menu.venues", "menu.clientApplications", "menu.settings"] },
  { group: "상단 유저 메뉴", keys: ["nav.myInfo", "nav.settings", "nav.home", "nav.logout"] },
  { group: "공통", keys: ["app.title", "footer.copyright"] },
  { group: "설정 하위 메뉴", keys: ["settings.menu.site", "settings.menu.notifications", "settings.menu.integration", "settings.menu.labels"] },
  {
    group: "사이트 안내/설명",
    keys: [
      "site.hero.tagline", "site.hero.titleText", "site.hero.subtitleText", "site.hero.descriptionText",
      "site.hero.titleHtml", "site.hero.titleLineHeight",
      "site.hero.btnTournaments", "site.hero.btnApply",
      "site.hero.btnPosition", "site.hero.btn1Size", "site.hero.btn2Size",
      "site.hero.btn1InternalPage", "site.hero.btn2InternalPage",
      "site.hero.taglineFont", "site.hero.taglineSize", "site.hero.taglineColor",
      "site.hero.taglineBold", "site.hero.taglineItalic", "site.hero.taglineUnderline", "site.hero.taglineAlign",
      "site.hero.titleFont", "site.hero.titleSize", "site.hero.titleColor",
      "site.hero.titleBold", "site.hero.titleItalic", "site.hero.titleUnderline", "site.hero.titleAlign",
      "site.hero.subtitleFont", "site.hero.subtitleSize", "site.hero.subtitleColor",
      "site.hero.subtitleBold", "site.hero.subtitleItalic", "site.hero.subtitleUnderline", "site.hero.subtitleAlign",
      "site.hero.taglineLineHeight", "site.hero.subtitleLineHeight",
      "site.home.tournaments.title", "site.home.tournaments.subtitle", "site.home.tournaments.subtitleEmpty",
      "site.home.tournaments.empty", "site.home.tournaments.btnList", "site.home.tournaments.btnViewAll", "site.home.tournaments.btnJoin",
      "site.home.venues.title", "site.home.venues.subtitle", "site.home.venues.subtitleWithList",
      "site.home.venues.empty", "site.home.venues.btnViewAll",
      "site.home.community.title", "site.home.community.subtitle",
      "site.home.community.notice.title", "site.home.community.notice.desc",
      "site.home.community.community.title", "site.home.community.community.desc",
      "site.home.quickApply.title", "site.home.quickApply.desc", "site.home.quickApply.btnApply", "site.home.quickApply.btnLogin",
      "site.home.location.title", "site.home.location.subtitle", "site.home.location.body", "site.home.location.hint",
      "site.footer.tagline",
      "site.tournaments.title", "site.tournaments.subtitle", "site.tournaments.empty", "site.tournaments.emptyHint",
      "site.venues.title", "site.venues.subtitle", "site.venues.empty",
      "site.community.title", "site.community.subtitle",
      "site.tournamentDetail.tabInfo", "site.tournamentDetail.infoEmpty",
    ],
  },
];
