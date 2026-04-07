import "server-only";

import { ContentLayer } from "@/components/content/ContentLayer";
import { getPopupsForPage } from "@/lib/content/service";

/**
 * 홈 팝업 데이터는 첫 화면 본문 이후에 준비해
 * 초기 진입 구간의 공통 데이터 부담을 줄인다.
 */
export async function HomeDeferredPopupLayer() {
  const popups = await getPopupsForPage("home");
  if (!Array.isArray(popups) || popups.length === 0) return null;
  return <ContentLayer popups={popups} />;
}

