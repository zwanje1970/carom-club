import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCommonPageData } from "@/lib/common-page-data";
import { buildCommunityHomeSlotCommunityPayload } from "@/lib/community-home-slot-context.server";
import { buildHomeSlotRenderPayload } from "@/lib/home-slot-render-data.server";
import { getHeroSettings } from "@/lib/hero-settings";
import { getPublicTournamentsListFromQuery, parsePublicTournamentsQuery } from "@/lib/public-tournaments-list-request.server";
import type { AdminCopyKey } from "@/lib/admin-copy";
import type { PageSlug } from "@/types/page-section";
import type { PageSlotRenderContext } from "@/types/page-slot-render-context";

const BUILDER_PAGES: PageSlug[] = ["home", "community", "tournaments"];

/**
 * 관리자 페이지 빌더 미리보기: `PageRenderer` 슬롯에 넣을 컨텍스트(공개 페이지와 동형).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") as PageSlug | null;
  if (!page || !BUILDER_PAGES.includes(page)) {
    return NextResponse.json(
      { error: "page는 home, community, tournaments 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  try {
    if (page === "home") {
      const requireTournaments = searchParams.get("requireTournaments") !== "0";
      const requireVenues = searchParams.get("requireVenues") !== "0";
      const common = await getCommonPageData("home");
      const [heroSettings, home] = await Promise.all([
        getHeroSettings(),
        buildHomeSlotRenderPayload({
          copy: common.copy,
          siteSettings: common.siteSettings,
          requireTournaments,
          requireVenues,
        }),
      ]);
      const body: PageSlotRenderContext = { page: "home", heroSettings, home };
      return NextResponse.json(body);
    }

    if (page === "community") {
      const common = await getCommonPageData("community");
      const community = await buildCommunityHomeSlotCommunityPayload("all");
      const body: PageSlotRenderContext = {
        page: "community",
        community: { ...community, copy: common.copy },
      };
      return NextResponse.json(body);
    }

    const emptySp: Record<string, string | string[] | undefined> = {};
    const [common, listRes] = await Promise.all([
      getCommonPageData("tournaments"),
      getPublicTournamentsListFromQuery(emptySp),
    ]);
    const parsed = parsePublicTournamentsQuery(emptySp);
    const c = common.copy as Record<AdminCopyKey, string>;
    const initialHasMore = listRes.list.length === parsed.take;
    const body: PageSlotRenderContext = {
      page: "tournaments",
      tournaments: {
        copy: c,
        initialList: listRes.list,
        initialHasMore,
        initialQuery: {
          tab: parsed.tab,
          sortBy: parsed.sortBy,
          national: parsed.nationalOnly,
        },
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[page-preview-context] GET error:", e);
    return NextResponse.json({ error: "미리보기 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
