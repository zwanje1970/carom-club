import type { MainSiteScrollCardItem } from "../../app/site/main-site-scroll-cards";
import type { SlideDeckItem } from "../../app/site/tournament-snapshot-card-view";

/** 메인 세로 스크롤: 게시 PNG(w480 우선) 1장만 표시 — 카드 DOM은 img+CTA만(오버레이·텍스트 HTML 중복 없음). */
export function slideDeckItemsToScrollCards(items: SlideDeckItem[]): MainSiteScrollCardItem[] {
  return items.map((item, index) => {
    const href = (item.targetDetailUrl ?? "").trim() || "/site/tournaments";
    const external = item.linkType === "external" || /^https?:\/\//i.test(href);
    const stableScroll =
      typeof item.mainSlideScrollStableId === "string" && item.mainSlideScrollStableId.trim()
        ? item.mainSlideScrollStableId.trim()
        : "";
    const rowId = stableScroll || `${item.snapshotId}__m${index}`;

    if (item.type === "ad") {
      const published640 = (item.publishedCardImageUrl ?? "").trim();
      const published320 = (item.publishedCardImage320Url ?? "").trim();
      const published480 = (item.publishedCardImage480Url ?? "").trim();
      const publishedScrollBg = published480 || published320 || published640;
      if (publishedScrollBg) {
        return {
          id: rowId,
          href,
          title: item.title,
          imageUrl: publishedScrollBg,
          faceCssBackground: null,
          external,
          slideDeckPngFace: true,
          slideDeckPngPlaceholder: false,
          slideDeckPngAdMark: true,
        };
      }
      const useBgImage = item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
      const imageUrl = useBgImage ? item.image320Url!.trim() : null;
      const faceCssBackground =
        !imageUrl && item.mediaBackground?.trim() ? item.mediaBackground.trim() : !imageUrl ? "transparent" : null;
      return {
        id: rowId,
        href,
        title: item.title,
        imageUrl,
        faceCssBackground,
        external,
        slideDeckPngFace: Boolean(imageUrl),
        slideDeckPngPlaceholder: !imageUrl,
        slideDeckPngAdMark: true,
      };
    }

    const published640 = (item.publishedCardImageUrl ?? "").trim();
    const published320 = (item.publishedCardImage320Url ?? "").trim();
    const published480 = (item.publishedCardImage480Url ?? "").trim();
    const scrollImg = published480 || published320 || published640;

    return {
      id: rowId,
      href,
      title: item.title,
      imageUrl: scrollImg || null,
      faceCssBackground: scrollImg ? null : "#0f172a",
      external,
      slideDeckPngFace: Boolean(scrollImg),
      slideDeckPngPlaceholder: !scrollImg,
      slideDeckPngAdMark: false,
    };
  });
}
