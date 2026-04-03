/**
 * DB 없이 화면 확인용 mock 데이터.
 * Neon 연결 후 이 모듈을 사용하는 fallback은 제거하고 실제 DB만 사용하면 됨.
 */

const now = new Date();
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);

export const MOCK_ORGANIZATION = {
  id: "mock-org-1",
  name: "CAROM.CLUB",
  slug: "carom-club",
  type: "CLUB" as const,
};

/** 진행 중 대회 샘플 2개 삭제됨. DB 데이터만 사용. */
export const MOCK_TOURNAMENTS_LIST: Array<{
  id: string;
  name: string;
  organizationId: string;
  organization: { id: string; name: string };
  venue: string;
  startAt: Date;
  endAt: Date | null;
  gameFormat: string;
  status: string;
}> = [];

export const MOCK_TOURNAMENT_DETAIL = {
  id: "mock-tournament-1",
  name: "2025 당구 오픈 대회",
  description: "<p>당구 애호가 여러분을 위한 오픈 대회입니다. 많은 참가 부탁드립니다.</p>",
  outlinePublished: "<p>참가비: 1만원<br/>일시: 매월 15일</p>",
  venue: "서울 당구장",
  startAt: nextMonth,
  endAt: nextMonth,
  gameFormat: "3구",
  isScotch: false,
  status: "OPEN",
  organization: MOCK_ORGANIZATION,
  rule: {
    id: "mock-rule-1",
    tournamentId: "mock-tournament-1",
    entryFee: 10000,
    operatingFee: 0,
    maxEntries: 32,
    useWaiting: true,
    entryConditions: "<p>참가 자격: 제한 없음</p>",
  },
  entries: [] as Array<{
    id: string;
    userId: string;
    userName: string;
    handicap: string | null;
    avg: string | null;
    depositorName: string | null;
    status: string;
    waitingListOrder: number | null;
  }>,
};

export const MOCK_VENUES_LIST = [
  { id: "mock-venue-1", name: "서울 당구장", slug: "seoul-billiards", type: "VENUE" as const },
  { id: "mock-venue-2", name: "강남 당구클럽", slug: "gangnam-club", type: "VENUE" as const },
];

export const MOCK_ORGANIZATIONS_LIST = [
  { id: MOCK_ORGANIZATION.id, name: MOCK_ORGANIZATION.name, slug: MOCK_ORGANIZATION.slug },
  ...MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug })),
];

/** 대회 상세 페이지용: id에 맞는 mock 반환 (없으면 첫 번째 mock) */
export function getMockTournamentById(id: string) {
  const base = { ...MOCK_TOURNAMENT_DETAIL, id };
  return {
    ...base,
    startAt: base.startAt,
    endAt: base.endAt ?? null,
    organization: MOCK_TOURNAMENT_DETAIL.organization,
    rule: MOCK_TOURNAMENT_DETAIL.rule,
    entries: MOCK_TOURNAMENT_DETAIL.entries,
  };
}
