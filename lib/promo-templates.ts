/**
 * 홍보 페이지 기본 템플릿 정의.
 * DB에 기본 템플릿이 없을 때 API에서 이 목록을 사용해 삽입하거나,
 * 목록 API에서 DB 결과와 병합해 반환할 수 있음.
 */
export const PROMO_TEMPLATE_CATEGORIES = [
  { value: "VENUE_INTRO", label: "당구장 소개형" },
  { value: "TOURNAMENT", label: "대회 모집형" },
  { value: "LESSON", label: "레슨 안내형" },
  { value: "EVENT", label: "이벤트 공지형" },
  { value: "CUSTOM", label: "기타" },
] as const;

export type PromoTemplateCategory = (typeof PROMO_TEMPLATE_CATEGORIES)[number]["value"];

export interface DefaultPromoTemplateDef {
  name: string;
  description: string;
  category: PromoTemplateCategory;
  contentHtml: string;
}

export const DEFAULT_PROMO_TEMPLATES: DefaultPromoTemplateDef[] = [
  {
    name: "당구장 소개형",
    description: "당구장 소개와 시설 안내용 기본 레이아웃",
    category: "VENUE_INTRO",
    contentHtml: [
      "<h2>당구장을 소개합니다</h2>",
      "<p>안녕하세요. 저희 당구장을 찾아주셔서 감사합니다.</p>",
      "<h3>시설 안내</h3>",
      "<p>대대 · 중대 · 포켓볼 테이블을 갖춰 두었습니다. 편한 복장으로 방문해 주세요.</p>",
      "<h3>이용 안내</h3>",
      "<ul>",
      "<li>운영시간: 평일 10:00 ~ 24:00</li>",
      "<li>문의: 전화 또는 카운터</li>",
      "</ul>",
      "<p>많은 이용 부탁드립니다.</p>",
    ].join(""),
  },
  {
    name: "대회 모집형",
    description: "대회 참가 신청용 홍보 페이지",
    category: "TOURNAMENT",
    contentHtml: [
      "<h2>대회 참가 신청</h2>",
      "<p>아래 대회 참가를 받고 있습니다. 많은 참여 바랍니다.</p>",
      "<h3>대회 개요</h3>",
      "<ul>",
      "<li>일시: (날짜·시간 입력)</li>",
      "<li>장소: (장소 입력)</li>",
      "<li>참가비: (금액 입력)</li>",
      "<li>신청 마감: (마감일 입력)</li>",
      "</ul>",
      "<h3>참가 방법</h3>",
      "<p>카운터 또는 전화로 신청해 주세요.</p>",
      "<p>※ 내용을 수정하여 사용하세요.</p>",
    ].join(""),
  },
  {
    name: "레슨 안내형",
    description: "레슨·강습 안내용",
    category: "LESSON",
    contentHtml: [
      "<h2>당구 레슨 안내</h2>",
      "<p>초보부터 상급자까지 맞춤 레슨을 진행합니다.</p>",
      "<h3>레슨 내용</h3>",
      "<ul>",
      "<li>기본 자세 및 큐 잡는 법</li>",
      "<li>당구 규칙 및 점수 계산</li>",
      "<li>실전 연습 및 게임</li>",
      "</ul>",
      "<h3>시간 및 비용</h3>",
      "<p>(레슨 시간·회당 비용 등을 입력해 주세요)</p>",
      "<p>문의: 전화 또는 방문 상담</p>",
    ].join(""),
  },
  {
    name: "이벤트 공지형",
    description: "이벤트·할인 공지용",
    category: "EVENT",
    contentHtml: [
      "<h2>이벤트 안내</h2>",
      "<p>아래 이벤트를 진행합니다. 많은 참여 부탁드립니다.</p>",
      "<h3>이벤트 내용</h3>",
      "<p>(이벤트 기간, 대상, 혜택 등을 입력해 주세요)</p>",
      "<h3>참여 방법</h3>",
      "<p>방문 시 카운터에 말씀해 주시면 됩니다.</p>",
      "<p>※ 자세한 내용은 당구장으로 문의해 주세요.</p>",
    ].join(""),
  },
];

/** API 응답용 템플릿 타입 (id 포함) */
export type PromoPageTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  contentHtml: string;
  isDefault: boolean;
  createdById: string | null;
  createdAt: string;
};
