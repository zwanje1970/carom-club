import { NextResponse } from "next/server";
import { visibleCommunityBoardKeysForTabs } from "../../../site/community/community-tab-config";
import {
  getMainSlideAdSettingsForSite,
  getSiteCommunityConfig,
  getSiteNotice,
  listCommunityPostsAllPrimaryForPublicSite,
  listSitePublicTournamentListSnapshotsForPublicSite,
  listTournamentSnapshotsForMainSite,
} from "../../../../lib/surface-read";

/**
 * 앱 WebView 스플래시 전용: 메인·커뮤니티 허브 첫 화면에 쓰는 공개 데이터만 가볍게 조회해
 * `unstable_cache` 워밍업(동일 키로 `/` RSC가 재요청 시 캐시 히트).
 * 응답 본문은 플래그만 — 대용량 JSON/원본 이미지 미포함.
 */
export async function GET() {
  const parts = { slide: false, community: false, tournaments: false };

  const slidePromise = Promise.allSettled([
    listTournamentSnapshotsForMainSite(),
    getMainSlideAdSettingsForSite(),
    getSiteNotice(),
  ]).then((r) => {
    parts.slide = r[0]?.status === "fulfilled" && r[1]?.status === "fulfilled";
  });

  const communityPromise = (async () => {
    try {
      const cfg = await getSiteCommunityConfig();
      const keys = visibleCommunityBoardKeysForTabs(cfg);
      await listCommunityPostsAllPrimaryForPublicSite(keys, undefined);
      parts.community = true;
    } catch {
      parts.community = false;
    }
  })();

  const tournamentsPromise = listSitePublicTournamentListSnapshotsForPublicSite()
    .then(() => {
      parts.tournaments = true;
    })
    .catch(() => {
      parts.tournaments = false;
    });

  await Promise.all([slidePromise, communityPromise, tournamentsPromise]);

  return NextResponse.json({ ok: true as const, parts });
}
