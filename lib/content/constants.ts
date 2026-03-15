import type { PageSlug, PlacementSlug, InternalPageSlug } from "@/types/page-section";
import type { PopupPageSlug } from "@/types/popup";
import type { NoticeBarPageSlug } from "@/types/notice-bar";

export const PAGE_LABELS: Record<PageSlug, string> = {
  home: "메인페이지",
  venues: "당구장 페이지",
  tournaments: "대회 페이지",
  community: "커뮤니티",
  mypage: "마이페이지",
};

export const PLACEMENT_LABELS: Record<PlacementSlug, string> = {
  below_header: "헤더 아래 / 메인 문구 위",
  main_visual_bg: "메인 비주얼 배경",
  below_main_copy: "메인 문구 아래",
  above_content: "본문 시작 위",
  content_middle: "본문 중간",
  content_bottom: "본문 하단",
};

/** 미니맵 영역 툴팁 설명 */
export const PLACEMENT_TOOLTIPS: Record<PlacementSlug, string> = {
  below_header: "사이트 상단 메뉴 바로 아래, 메인 문구 위 영역",
  main_visual_bg: "메인 비주얼/히어로 배너 영역",
  below_main_copy: "메인 문구 아래, 본문 직전 영역",
  above_content: "본문 시작 직전 첫 번째 콘텐츠 영역",
  content_middle: "본문 중간 콘텐츠 영역",
  content_bottom: "페이지 하단, 푸터 직전 영역",
};

/** 선택 위치별 안내 문구 (미니맵 아래 표시) */
export const PLACEMENT_HINTS: Record<PlacementSlug, string> = {
  below_header: "헤더 바로 아래에는 공지 배너나 강조 문구를 배치하기 좋습니다.",
  main_visual_bg: "메인 비주얼에는 대형 배너 이미지를 배치하는 것이 좋습니다.",
  below_main_copy: "메인 문구 아래에는 요약 텍스트나 CTA를 배치하기 좋습니다.",
  above_content: "본문 상단에는 본문 도입부나 강조 섹션을 배치하기 좋습니다.",
  content_middle: "본문 중간에는 홍보 배너나 안내 콘텐츠를 배치하는 것이 좋습니다.",
  content_bottom: "페이지 하단에는 마무리 CTA나 부가 안내를 배치하기 좋습니다.",
};

/** 미니맵 박스 표시용 짧은 라벨 */
export const PLACEMENT_MINIMAP_LABELS: Record<PlacementSlug, string> = {
  below_header: "HEADER 아래",
  main_visual_bg: "HERO AREA",
  below_main_copy: "메인 문구 아래",
  above_content: "CONTENT TOP",
  content_middle: "CONTENT MIDDLE",
  content_bottom: "CONTENT BOTTOM",
};

/** 위치별 권장 이미지 크기 (가로 x 세로 px). UI 안내용 */
export const RECOMMENDED_IMAGE_SIZES: Record<PlacementSlug, { desktop: string; mobile: string }> = {
  below_header: { desktop: "1600 x 600", mobile: "800 x 400" },
  main_visual_bg: { desktop: "1920 x 1080", mobile: "900 x 600" },
  below_main_copy: { desktop: "1200 x 500", mobile: "800 x 500" },
  above_content: { desktop: "1200 x 500", mobile: "800 x 1000" },
  content_middle: { desktop: "1200 x 500", mobile: "800 x 1000" },
  content_bottom: { desktop: "1200 x 500", mobile: "800 x 600" },
};

export const INTERNAL_PAGE_LABELS: Record<InternalPageSlug, string> = {
  home: "홈",
  venues: "당구장 목록",
  tournaments: "대회 목록",
  community: "커뮤니티",
  mypage: "마이페이지",
  login: "로그인",
  signup: "회원가입",
};

export const INTERNAL_PAGE_PATHS: Record<InternalPageSlug, string> = {
  home: "/",
  venues: "/venues",
  tournaments: "/tournaments",
  community: "/community",
  mypage: "/mypage",
  login: "/login",
  signup: "/signup",
};

export const POPUP_PAGE_LABELS: Record<PopupPageSlug, string> = {
  all: "전체 페이지",
  home: "메인페이지",
  venues: "당구장 페이지",
  tournaments: "대회 페이지",
  community: "커뮤니티",
};

export const NOTICE_BAR_PAGE_LABELS: Record<NoticeBarPageSlug, string> = {
  all: "전체 페이지",
  home: "메인페이지",
  venues: "당구장 페이지",
  tournaments: "대회 페이지",
  community: "커뮤니티",
};

export const SECTION_TYPE_LABELS = {
  image: "이미지 섹션",
  text: "텍스트 섹션",
  cta: "버튼 섹션",
} as const;

export const TEXT_ALIGN_LABELS = {
  left: "왼쪽 정렬",
  center: "가운데 정렬",
  right: "오른쪽 정렬",
} as const;
