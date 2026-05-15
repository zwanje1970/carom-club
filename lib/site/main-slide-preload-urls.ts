import type { SlideDeckItem } from "../../app/site/tournament-snapshot-card-view";
import type { PublishedCardSnapshot } from "../server/platform-backing-store";
import { slideDeckItemsToScrollCards } from "./slide-deck-items-to-scroll-cards";

/** `/site` 메인과 동일 — 테스트용 포스터 광고 슬라이드 제외 */
export function isMainSitePosterTestSlideItem(item: SlideDeckItem): boolean {
  const t = (item.title ?? "").trim();
  if (!/\[TEST\]/i.test(t)) return false;
  return /포스터\s*광고판\s*확인\s*(?:[1-5]|[１-５])\s*$/i.test(t);
}

export function snapshotToTournamentSlideDeckItem(snapshot: PublishedCardSnapshot): SlideDeckItem {
  const pub320 =
    typeof snapshot.publishedCardImage320Url === "string" ? snapshot.publishedCardImage320Url.trim() : "";
  const pub480 =
    typeof snapshot.publishedCardImage480Url === "string" ? snapshot.publishedCardImage480Url.trim() : "";
  const pub640 = typeof snapshot.publishedCardImageUrl === "string" ? snapshot.publishedCardImageUrl.trim() : "";
  return {
    type: "tournament",
    linkType: "internal",
    snapshotId: snapshot.snapshotId,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    targetDetailUrl: snapshot.targetDetailUrl,
    ...(pub640 ? { publishedCardImageUrl: pub640 } : {}),
    ...(pub320 ? { publishedCardImage320Url: pub320 } : {}),
    ...(pub480 ? { publishedCardImage480Url: pub480 } : {}),
  };
}

/** 메인 슬라이드 게시카드 PNG URL (w480→w320→w640, 광고·공지 제외) */
export function mainSlideTournamentImageUrlsFromSnapshots(snapshots: PublishedCardSnapshot[]): string[] {
  const deckItems = snapshots
    .map(snapshotToTournamentSlideDeckItem)
    .filter((item) => !isMainSitePosterTestSlideItem(item));
  const scrollItems = slideDeckItemsToScrollCards(deckItems);
  const urls: string[] = [];
  for (const item of scrollItems) {
    const url = item.imageUrl?.trim() ?? "";
    if (!url || urls.includes(url)) continue;
    urls.push(url);
  }
  return urls;
}
