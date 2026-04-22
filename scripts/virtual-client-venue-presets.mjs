/**
 * vclient01~10 사업장(당구장) 데모 구성.
 * - 1~5: 대대전용 — 1~2 정액제(FLAT), 3~5 일반요금(GENERAL)
 * - 6~10: 복합구장 — 모두 일반요금(GENERAL)
 *
 * typeSpecificJson은 lib/client-organization-setup-types.ts 의 VenueSpecific 과 호환.
 */

const DEMO_HOURS = "평일 12:00~24:00, 주말 10:00~02:00 (가상 데모)";

const REGIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "제주"];

const ROADS = [
  "서울 강남구 테헤란로",
  "성남시 분당구 판교로",
  "인천 연수구 컨벤시아대로",
  "부산 해운대구 해운대해변로",
  "대구 중구 동성로",
  "광주 북구 첨단과기로",
  "대전 유성구 대학로",
  "울산 남구 삼산로",
  "세종특별자치시 조치원읍",
  "제주시 연동",
];

/**
 * @param {number} n 1..10
 */
export function getVirtualVenuePreset(n) {
  if (n < 1 || n > 10) throw new Error(`preset index out of range: ${n}`);

  const region = REGIONS[n - 1] ?? "서울";
  const address = `${ROADS[n - 1] ?? "서울특별시"} ${n}길 ${10 + n} (데모)`;

  /** @type {Record<string, unknown>} */
  let typeSpecific;
  /** @type {string} */
  let orgName;
  /** @type {string} */
  let shortDescription;

  if (n <= 2) {
    const label = n === 1 ? "A" : "B";
    orgName = `가상 대대전용 정액 ${label}`;
    shortDescription = "대대전용 구장 · 정액제 (가상 데모)";
    typeSpecific = {
      venueCategory: "daedae_only",
      pricingType: "FLAT",
      feeCategory: "flat",
      flatRateInfo: `대대 2인 기준 시간당 ${7000 + n * 200}원 정액 (데모)`,
      daedae: { count: "6", kind: "하이런", fee: `정액 ${7000 + n * 200}원/시간` },
      businessHours: DEMO_HOURS,
    };
  } else if (n <= 5) {
    const k = n - 2;
    orgName = `가상 대대전용 일반 ${k}`;
    shortDescription = "대대전용 구장 · 일반요금 (가상 데모)";
    typeSpecific = {
      venueCategory: "daedae_only",
      pricingType: "GENERAL",
      feeCategory: "normal",
      daedae: { count: "8", kind: "강호", fee: "30분 4,000원~ (데모)" },
      businessHours: DEMO_HOURS,
    };
  } else {
    const k = n - 5;
    orgName = `가상 복합구장 ${k}`;
    shortDescription = "복합구장 · 일반요금 (가상 데모)";
    typeSpecific = {
      venueCategory: "mixed",
      pricingType: "GENERAL",
      feeCategory: "normal",
      daedae: { count: "4", kind: "하이런", fee: "30분 4,500원 (데모)" },
      jungdae: { count: "2", kind: "강호", fee: "30분 4,000원 (데모)" },
      pocket: { count: "3", kind: "포켓", fee: "게임당 5,000원 (데모)" },
      businessHours: DEMO_HOURS,
    };
  }

  const userDisplayName = `${orgName} 관리자`;
  const typeSpecificJson = JSON.stringify(typeSpecific);

  return {
    orgName,
    shortDescription,
    description: `${shortDescription}\n로그인: vclient${String(n).padStart(2, "0")} (데모 데이터)`,
    userDisplayName,
    typeSpecificJson,
    region,
    address,
    latitude: Math.round((37.5 + n * 0.012) * 1e6) / 1e6,
    longitude: Math.round((126.98 + n * 0.015) * 1e6) / 1e6,
    isPublished: true,
    setupCompleted: true,
  };
}
