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
  "site.community.billiardNotes.title": "당구노트",
  "site.tournamentDetail.tabInfo": "대회 안내",
  "site.tournamentDetail.infoEmpty": "안내 내용이 없습니다.",
  // 대회/권역 용어 (관리자 메뉴·문구에서 변경 가능)
  "site.tournament.bracketSectionTitle": "대진 · 결과",
  "site.tournament.qualifierLabel": "권역 예선",
  "site.tournament.finalBracketLabel": "본선 대진표",
  "site.tournament.resultsLabel": "경기 결과",
  "site.tournament.stage.SETUP": "설정",
  "site.tournament.stage.QUALIFIER_RUNNING": "권역 예선 진행 중",
  "site.tournament.stage.QUALIFIER_COMPLETED": "권역 예선 완료",
  "site.tournament.stage.FINAL_READY": "본선 준비",
  "site.tournament.stage.FINAL_RUNNING": "본선 진행 중",
  "site.tournament.stage.COMPLETED": "종료",
  "site.tournament.finalLabel": "본선",
  "site.tournament.zonesEmpty": "권역이 없습니다.",
  "site.tournament.finalBracketView": "본선 대진표 보기",
  "site.tournament.finalBracketNotCreated": "본선 대진이 생성되지 않았습니다.",
  "site.tournament.finalBracketNotCreatedYet": "본선 대진이 아직 생성되지 않았습니다.",

  // ----- 관리자 공통 (버튼·액션·테이블 등) -----
  "admin.common.back": "뒤로 가기",
  "admin.common.goToDashboard": "대시보드로 가기",
  "admin.common.save": "저장",
  "admin.common.saving": "저장중",
  "admin.common.saved": "저장되었습니다.",
  "admin.common.cancel": "취소",
  "admin.common.delete": "삭제",
  "admin.common.edit": "수정",
  "admin.common.add": "추가",
  "admin.common.remove": "제거",
  "admin.common.search": "검색",
  "admin.common.list": "목록",
  "admin.common.resetToDefault": "기본값으로 되돌리기",
  "admin.common.active": "활성",
  "admin.common.inactive": "비활성",
  "admin.common.actions": "동작",
  "admin.common.preview": "미리보기",
  "admin.common.type": "타입",
  "admin.common.title": "제목",
  "admin.common.content": "내용",
  "admin.common.findPlaceholder": "찾을 문자열",
  "admin.common.replacePlaceholder": "바꿀 문자열",
  "admin.common.bulkReplace": "일괄 변경",
  "admin.common.bulkReplaceRun": "치환 실행",
  "admin.common.logoutConfirm": "저장하지 않은 내용이 있습니다. 로그아웃하면 해당 내용은 유지되지 않습니다. 로그아웃하시겠습니까?",

  // ----- 플랫폼 대시보드 -----
  "admin.dashboard.title": "플랫폼 운영 대시보드",
  "admin.dashboard.subtitle": "플랫폼 운영·모니터링용 대시보드입니다. 대회 실무(생성/수정/참가자/대진표)는 클라이언트 관리자(/client) 콘솔에서 진행합니다.",
  "admin.dashboard.quickLinks": "바로가기",
  "admin.dashboard.statClients": "클라이언트",
  "admin.dashboard.statPending": "승인 대기",
  "admin.dashboard.statTournaments": "전체 대회",
  "admin.dashboard.statInquiries": "문의",

  // ----- 설정 페이지별 제목·설명·라벨 -----
  "admin.settings.title": "설정",
  "admin.settings.pickItem": "설정 항목을 선택하세요.",
  "admin.settings.labels.title": "메뉴/문구",
  "admin.settings.labels.description": "사이트에 노출되는 메뉴명·버튼·안내 문구가 모두 아래에 표시됩니다. (회원이 입력한 게시글·댓글 등은 제외) 개별 수정(1개씩) 또는 일괄 변경 후 저장하면 반영됩니다.",
  "admin.settings.labels.searchLabel": "메뉴/문구 찾기",
  "admin.settings.labels.searchPlaceholder": "키 또는 문구로 검색 (예: 대회, 메뉴, hero)",
  "admin.settings.labels.bulkSectionTitle": "일괄 변경",
  "admin.settings.labels.bulkSectionDesc": "아래 표시된 문구 안에서만 찾아 바꿉니다. 검색으로 범위를 좁힌 뒤 적용하면 선택한 문구만 일괄 변경됩니다.",
  "admin.settings.labels.fixedTextLink": "고정 문구 관리",
  "admin.settings.labels.fixedTextNote": "에러 메시지·빈 화면 안내 등은",
  "admin.settings.labels.fixedTextNoteSuffix": "에서 수정할 수 있습니다.",
  "admin.settings.systemText.title": "고정 문구 관리",
  "admin.settings.systemText.groupLabel": "그룹",
  "admin.settings.systemText.searchLabel": "검색 (key / label / value)",
  "admin.settings.systemText.seedBtn": "기본 키 시드",
  "admin.settings.systemText.resetAllBtn": "전체 기본값 초기화",
  "admin.settings.systemText.bulkSectionTitle": "단어 전체 치환",
  "admin.settings.notices.title": "공지 관리",
  "admin.settings.notices.typeBar": "공지바",
  "admin.settings.notices.typePopup": "팝업",
  "admin.settings.notices.typeEmergency": "긴급 공지",
  "admin.settings.notices.addBtn": "공지 추가",
  "admin.settings.notices.editTitle": "공지 수정",
  "admin.settings.notices.exposurePeriod": "노출 기간",
  "admin.settings.notices.mobile": "모바일",
  "admin.settings.features.title": "기능 관리",
  "admin.settings.backup.title": "데이터 백업",
  "admin.settings.backup.runBtn": "백업 실행",
  "admin.settings.backup.running": "백업 실행 중…",
  "admin.settings.backup.listTitle": "백업 목록",
  "admin.settings.backup.filename": "파일명",
  "admin.settings.backup.size": "크기",
  "admin.settings.backup.createdAt": "생성일시",
  "admin.settings.backup.restoreTitle": "복원 안내",
  "admin.settings.backup.cronTitle": "일일 자동 백업",
  "admin.settings.system.title": "시스템 관리",
  "admin.settings.system.pathRevalidate": "경로 재검증",
  "admin.settings.system.revalidatePathBtn": "해당 경로만 재검증",
  "admin.settings.system.clearCacheBtn": "전체 주요 경로 캐시 초기화",
  "admin.settings.site.title": "사이트 설정",
  "admin.settings.site.logoLabel": "사이트 로고",
  "admin.settings.site.logoPreviewAlt": "로고 미리보기",
  "admin.settings.site.chooseImage": "이미지 선택",
  "admin.settings.site.chooseAnotherImage": "다른 이미지 선택",
  "admin.settings.integration.title": "연동 설정",
  "admin.settings.integration.currentStatus": "현재 설정 상태",
  "admin.settings.integration.configured": "설정됨",
  "admin.settings.integration.notConfigured": "미설정",
  "admin.settings.notifications.title": "알림 설정",
  "admin.settings.footer.title": "푸터 설정",
  "admin.settings.footer.useFooter": "푸터 사용",
  "admin.settings.footer.bgColor": "배경색",
  "admin.settings.footer.textColor": "글자색",
  "admin.settings.footer.sponsorTitle": "주관사 정보",
  "admin.settings.footer.partnersTitle": "협력업체",
  "admin.settings.footer.addPartner": "추가",
  "admin.settings.footer.partnerNamePlaceholder": "업체명",
  "admin.settings.featured.title": "추천 콘텐츠 관리",
  "admin.settings.featured.addSectionTitle": "추천 추가",
  "admin.settings.featured.typeTournament": "대회",
  "admin.settings.featured.typeVenue": "당구장",
  "admin.settings.featured.typePost": "게시글",
  "admin.settings.billing.title": "요금 정책",
  "admin.settings.billing.enableTitle": "요금 정책 활성화",
  "admin.settings.header.title": "헤더 설정",
  "admin.settings.header.bgColor": "헤더 배경색",
  "admin.settings.header.textColor": "헤더 글자색",
  "admin.settings.header.activeColor": "활성 메뉴 강조색",
  "admin.participants.title": "참가자 관리",
  "admin.participants.clientOnlyTitle": "참가자 관리는 클라이언트 관리자 전용입니다",
  "admin.participants.backToTournaments": "대회 현황",
  "admin.tournament.newSave": "새 대회 저장",
  "admin.tournament.copyFromPrevious": "이전 대회를 복사해 날짜·장소 등만 수정해 새 대회로 등록할 수 있습니다.",
  "admin.tournament.venueNameReadonly": "당구장명 (수정 불가)",
  "admin.tournament.addressReadonly": "주소 (수정 불가)",
  "admin.tournament.addVenue": "대회 당구장 (개최 장소로 추가)",
  "admin.tournament.selectVenuePlaceholder": "당구장 선택 후 추가",
  "admin.tournament.bracketSettings": "대진표 설정",
  "admin.tournament.entrySettings": "참가 설정",
  "admin.tournament.prizeSettings": "상금 설정",
  "admin.clientOnly.title": "클라이언트 관리자 전용",
  "admin.clientOnly.message": "이 기능은 대회를 운영하는 클라이언트 관리자 전용입니다. 플랫폼 관리자는 대회 생성·수정·참가자·대진표 관리를 할 수 없습니다.",
  "admin.forbidden.title": "캐롬클럽 관리자 권한이 없습니다",
  "admin.forbidden.notAdmin": "이 계정은 관리자가 아닙니다.",
  "admin.forbidden.loginHint": "관리자 전용 계정(아이디: admin)으로 로그인하세요. 계정이 없다면 터미널에서 npx prisma db seed를 실행한 뒤 비밀번호 admin1234로 로그인하세요.",
  "admin.forbidden.logoutHint": "지금 로그인된 계정을 로그아웃한 뒤 admin으로 다시 로그인하세요.",
  "admin.forbidden.logoutAndLoginBtn": "로그아웃 후 관리자로 로그인",
  "admin.forbidden.goHome": "메인으로 이동",

  // ----- 클라이언트 대시보드 -----
  "client.dashboard.title": "대회 운영 대시보드",
  "client.dashboard.label": "대시보드",
  "client.dashboard.goTo": "대시보드로",
  "client.dashboard.loginPrompt": "클라이언트 대시보드는 로그인 후 이용할 수 있습니다.",
  "client.dashboard.consoleTitle": "대회 운영 콘솔",
  "client.zones.title": "부/권역 설정",
  "client.zones.description": "대회별 권역 연결은 각 대회 상세 → 부/권역 탭에서 설정할 수 있습니다. 권역별 예선·본선 운영 시 사용합니다.",
  "client.sidebar.dashboard": "대시보드",
  "client.sidebar.myTournaments": "내 대회",
  "client.sidebar.participants": "참가자 관리",
  "client.sidebar.zones": "부/권역 설정",
  "client.sidebar.brackets": "대진표 관리",
  "client.sidebar.results": "결과 관리",
  "client.sidebar.coAdmins": "공동관리자 관리",
  "client.sidebar.promo": "홍보/페이지 관리",
  "client.sidebar.setup": "조직 설정",
  "client.sidebar.billing": "이용 현황",
  "client.sidebar.myZones": "내가 맡은 권역",
  "client.sidebar.zoneOps": "권역 운영",
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
  { group: "사이드 메뉴", keys: ["menu.home", "menu.dashboard", "menu.tournaments", "menu.participants", "menu.brackets", "menu.members", "menu.inquiries", "menu.venues", "menu.venueList", "menu.clientApplications", "menu.settings"] },
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
      "site.community.title", "site.community.subtitle", "site.community.billiardNotes.title",
      "site.tournamentDetail.tabInfo", "site.tournamentDetail.infoEmpty",
    ],
  },
  {
    group: "대회/권역 용어",
    keys: [
      "site.tournament.bracketSectionTitle", "site.tournament.qualifierLabel", "site.tournament.finalBracketLabel", "site.tournament.resultsLabel",
      "site.tournament.finalLabel", "site.tournament.zonesEmpty", "site.tournament.finalBracketView",
      "site.tournament.finalBracketNotCreated", "site.tournament.finalBracketNotCreatedYet",
      "site.tournament.stage.SETUP", "site.tournament.stage.QUALIFIER_RUNNING", "site.tournament.stage.QUALIFIER_COMPLETED",
      "site.tournament.stage.FINAL_READY", "site.tournament.stage.FINAL_RUNNING", "site.tournament.stage.COMPLETED",
    ],
  },
  {
    group: "관리자 공통 (버튼·액션)",
    keys: [
      "admin.common.back", "admin.common.goToDashboard", "admin.common.save", "admin.common.saving", "admin.common.saved",
      "admin.common.cancel", "admin.common.delete", "admin.common.edit", "admin.common.add", "admin.common.remove",
      "admin.common.search", "admin.common.list", "admin.common.resetToDefault", "admin.common.active", "admin.common.inactive",
      "admin.common.actions", "admin.common.preview", "admin.common.type", "admin.common.title", "admin.common.content",
      "admin.common.findPlaceholder", "admin.common.replacePlaceholder", "admin.common.bulkReplace", "admin.common.bulkReplaceRun",
      "admin.common.logoutConfirm",
    ],
  },
  {
    group: "플랫폼 대시보드",
    keys: [
      "admin.dashboard.title", "admin.dashboard.subtitle", "admin.dashboard.quickLinks",
      "admin.dashboard.statClients", "admin.dashboard.statPending", "admin.dashboard.statTournaments", "admin.dashboard.statInquiries",
    ],
  },
  {
    group: "설정 페이지별",
    keys: [
      "admin.settings.title", "admin.settings.pickItem",
      "admin.settings.labels.title", "admin.settings.labels.description", "admin.settings.labels.searchLabel", "admin.settings.labels.searchPlaceholder",
      "admin.settings.labels.bulkSectionTitle", "admin.settings.labels.bulkSectionDesc", "admin.settings.labels.fixedTextLink", "admin.settings.labels.fixedTextNote", "admin.settings.labels.fixedTextNoteSuffix",
      "admin.settings.systemText.title", "admin.settings.systemText.groupLabel", "admin.settings.systemText.searchLabel", "admin.settings.systemText.seedBtn", "admin.settings.systemText.resetAllBtn", "admin.settings.systemText.bulkSectionTitle",
      "admin.settings.notices.title", "admin.settings.notices.typeBar", "admin.settings.notices.typePopup", "admin.settings.notices.typeEmergency", "admin.settings.notices.addBtn", "admin.settings.notices.editTitle", "admin.settings.notices.exposurePeriod", "admin.settings.notices.mobile",
      "admin.settings.features.title", "admin.settings.backup.title", "admin.settings.backup.runBtn", "admin.settings.backup.running", "admin.settings.backup.listTitle", "admin.settings.backup.filename", "admin.settings.backup.size", "admin.settings.backup.createdAt", "admin.settings.backup.restoreTitle", "admin.settings.backup.cronTitle",
      "admin.settings.system.title", "admin.settings.system.pathRevalidate", "admin.settings.system.revalidatePathBtn", "admin.settings.system.clearCacheBtn",
      "admin.settings.site.title", "admin.settings.site.logoLabel", "admin.settings.site.logoPreviewAlt", "admin.settings.site.chooseImage", "admin.settings.site.chooseAnotherImage",
      "admin.settings.integration.title", "admin.settings.integration.currentStatus", "admin.settings.integration.configured", "admin.settings.integration.notConfigured",
      "admin.settings.notifications.title", "admin.settings.footer.title", "admin.settings.footer.useFooter", "admin.settings.footer.bgColor", "admin.settings.footer.textColor", "admin.settings.footer.sponsorTitle", "admin.settings.footer.partnersTitle", "admin.settings.footer.addPartner", "admin.settings.footer.partnerNamePlaceholder",
      "admin.settings.featured.title", "admin.settings.featured.addSectionTitle", "admin.settings.featured.typeTournament", "admin.settings.featured.typeVenue", "admin.settings.featured.typePost",
      "admin.settings.billing.title", "admin.settings.billing.enableTitle", "admin.settings.header.title", "admin.settings.header.bgColor", "admin.settings.header.textColor", "admin.settings.header.activeColor",
    ],
  },
  {
    group: "참가자·대회·클라이언트 전용 안내",
    keys: [
      "admin.participants.title", "admin.participants.clientOnlyTitle", "admin.participants.backToTournaments",
      "admin.tournament.newSave", "admin.tournament.copyFromPrevious", "admin.tournament.venueNameReadonly", "admin.tournament.addressReadonly", "admin.tournament.addVenue", "admin.tournament.selectVenuePlaceholder",
      "admin.tournament.bracketSettings", "admin.tournament.entrySettings", "admin.tournament.prizeSettings",
      "admin.clientOnly.title", "admin.clientOnly.message", "admin.forbidden.title", "admin.forbidden.notAdmin", "admin.forbidden.loginHint", "admin.forbidden.logoutHint", "admin.forbidden.logoutAndLoginBtn", "admin.forbidden.goHome",
    ],
  },
  {
    group: "클라이언트 대시보드",
    keys: [
      "client.dashboard.title", "client.dashboard.label", "client.dashboard.goTo", "client.dashboard.loginPrompt", "client.dashboard.consoleTitle",
      "client.zones.title", "client.zones.description",
      "client.sidebar.dashboard", "client.sidebar.myTournaments", "client.sidebar.participants", "client.sidebar.zones", "client.sidebar.brackets", "client.sidebar.results", "client.sidebar.coAdmins", "client.sidebar.promo", "client.sidebar.setup", "client.sidebar.billing", "client.sidebar.myZones", "client.sidebar.zoneOps",
    ],
  },
];
