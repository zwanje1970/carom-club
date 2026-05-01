/**
 * 게시카드 게시 직후 메인 반영 지연 안내(클라이언트 표시용).
 *
 * 근거: `lib/server/public-data-cache.ts` — 메인 슬라이드 스냅샷과 같은 태그 묶음으로
 * `revalidateMainSlideSnapshotsCache`가 무효화하는 `CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST` 캐시가
 * `unstable_cache`에 `revalidate: 60`으로 걸려 있어, 최악의 주기적 갱신 지연은 약 1분 수준으로 안내한다.
 * (메인 슬라이드 전용 캐시 항목 자체에는 `revalidate` 숫자가 없음.)
 */
export const PUBLISHED_CARD_MAIN_REFLECT_NOTICE_KO = "게시카드는 약 1분 후 메인에 반영됩니다.";

export function withPublishedCardMainReflectNotice(successBody: string): string {
  return `${successBody}\n\n${PUBLISHED_CARD_MAIN_REFLECT_NOTICE_KO}`;
}
