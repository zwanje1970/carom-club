import "server-only";
import { unstable_cache } from "next/cache";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTournamentsListForPublicPage } from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { parsePublicTournamentsQuery } from "@/lib/public-tournaments-list-request";

export * from "@/lib/public-tournaments-list-request";

export type PublicTournamentsListRow = Awaited<
  ReturnType<typeof getTournamentsListForPublicPage>
>[number];

/**
 * 공개 대회 목록(한 번의 DB 조회). API 라우트·서버 페이지에서 공통 사용.
 */
export async function getPublicTournamentsListFromQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): Promise<{ ok: true; list: PublicTournamentsListRow[] }> {
  console.time("tournaments_list_total");
  if (!isDatabaseConfigured()) {
    console.timeEnd("tournaments_list_total");
    return { ok: true, list: [] };
  }

  const parsed = parsePublicTournamentsQuery(input);
  console.time("tournaments_list_query");

  if (parsed.sortBy !== "distance") {
    const list = await getPublicTournamentsListCachedNoDistance(parsed);
    console.timeEnd("tournaments_list_query");
    console.timeEnd("tournaments_list_total");
    return { ok: true, list };
  }

  console.time("tournaments_list_resolve_coords");
  let lat = parsed.latFromQuery;
  let lng = parsed.lngFromQuery;

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (lat !== 0 || lng !== 0)) {
    const session = await getSession();
    if (session?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { latitude: true, longitude: true },
      });
      if (user?.latitude != null && user?.longitude != null) {
        lat = user.latitude;
        lng = user.longitude;
      }
    }
  }
  console.timeEnd("tournaments_list_resolve_coords");

  const list = await getTournamentsListForPublicPage({
    tab: parsed.tab,
    sortBy: parsed.sortBy,
    nationalOnly: parsed.nationalOnly,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    take: parsed.take,
    skip: parsed.skip,
  });
  console.timeEnd("tournaments_list_query");
  console.timeEnd("tournaments_list_total");

  return { ok: true, list };
}

const getPublicTournamentsListCachedNoDistance = unstable_cache(
  async (parsed: ReturnType<typeof parsePublicTournamentsQuery>) => {
    return getTournamentsListForPublicPage({
      tab: parsed.tab,
      sortBy: parsed.sortBy,
      nationalOnly: parsed.nationalOnly,
      take: parsed.take,
      skip: parsed.skip,
    });
  },
  ["public-tournaments-list-no-distance"],
  { revalidate: 60, tags: ["public-tournaments-list"] }
);
