import "server-only";

import { ContentLayer } from "@/components/content/ContentLayer";
import { getPopupsForPage } from "@/lib/content/service";

/**
 * 커뮤니티 팝업은 본문 이후에 준비해
 * 목록 첫 화면 체감 구간의 공통 데이터 부담을 줄인다.
 */
export async function CommunityDeferredPopupLayer() {
  const popups = await getPopupsForPage("community");
  if (!Array.isArray(popups) || popups.length === 0) return null;
  return <ContentLayer popups={popups} />;
}
