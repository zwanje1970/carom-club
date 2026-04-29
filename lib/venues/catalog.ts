/** 정적 샘플 카탈로그 제거. API 등은 비어 있지 않은 venueId 문자열만 허용한다. */
export const VENUE_CATALOG: Record<string, { name: string; region: string; type: string; description: string }> = {};

export type SupportedVenueId = string;

export function isSupportedVenueId(value: string): value is SupportedVenueId {
  return typeof value === "string" && value.trim() !== "";
}
