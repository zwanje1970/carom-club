import { NextResponse } from "next/server";
import { parseCommunityBoardTypeParam } from "../../../../../lib/community-board-params";
import { getDefaultSiteCommunityConfigForPublicSite } from "../../../../../lib/server/platform-backing-store";
import {
  getSiteCommunityConfig,
  listCommunityPostsAllPrimaryForPublicSite,
  listCommunityPostsForPublicSite,
} from "../../../../../lib/surface-read";
import { visibleCommunityBoardKeysForTabs } from "../../../../site/community/community-tab-config";

export const runtime = "nodejs";

/** 공개 사이트 커뮤니티 목록 — `listCommunityPostsForPublicSite` / `listCommunityPostsAllPrimaryForPublicSite`와 동일 정책 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const q = (url.searchParams.get("q") ?? "").trim();
  const listOptions = q ? { q } : undefined;

  let config;
  try {
    config = await getSiteCommunityConfig();
  } catch (e) {
    console.error("[api/site/community/public-posts] getSiteCommunityConfig failed", e);
    config = getDefaultSiteCommunityConfigForPublicSite();
  }

  if (scope === "all") {
    const visibleBoardKeys = visibleCommunityBoardKeysForTabs(config);
    try {
      const items = await listCommunityPostsAllPrimaryForPublicSite(visibleBoardKeys, listOptions);
      return NextResponse.json({ scope: "all", items });
    } catch (e) {
      console.error("[api/site/community/public-posts] list all failed", e);
      return NextResponse.json({ scope: "all", items: [] });
    }
  }

  const boardType = parseCommunityBoardTypeParam(url.searchParams.get("boardType") ?? "");
  if (!boardType) {
    return NextResponse.json({ error: "boardType이 필요합니다." }, { status: 400 });
  }
  if (!config[boardType].visible) {
    return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const items = await listCommunityPostsForPublicSite(boardType, listOptions);
    return NextResponse.json({ boardType, items });
  } catch (e) {
    console.error("[api/site/community/public-posts] list board failed", { boardType, e });
    return NextResponse.json({ boardType, items: [] });
  }
}
