export const VENUE_CATALOG = {
  "venue-1": {
    name: "카롬 강남점",
    region: "서울 강남",
    type: "클럽형",
    description: "대회 연습과 일반 이용이 가능한 강남 지역 제휴 당구장입니다.",
  },
  "venue-2": {
    name: "카롬 서초점",
    region: "서울 서초",
    type: "대회협력",
    description: "대회 운영 협력 지점으로 행사 진행 경험이 많은 제휴 매장입니다.",
  },
  "venue-3": {
    name: "카롬 수원점",
    region: "경기 수원",
    type: "일반형",
    description: "지역 동호회 이용이 많은 수원 지역 일반형 제휴 당구장입니다.",
  },
} as const;

export type SupportedVenueId = keyof typeof VENUE_CATALOG;

export function isSupportedVenueId(value: string): value is SupportedVenueId {
  return value in VENUE_CATALOG;
}
