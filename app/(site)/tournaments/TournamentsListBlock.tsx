import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { TournamentsListWithFilters } from "@/components/tournaments/TournamentsListWithFilters";
import type { AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import {
  getPublicTournamentsListFromQuery,
  parsePublicTournamentsQuery,
} from "@/lib/public-tournaments-list-request.server";
import { logServerTiming } from "@/lib/perf";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

/** 공통 데이터 + 대회 목록 병렬 페칭 후 클라이언트 목록에 전달 */
export async function TournamentsListBlock({ searchParams: sp }: Props) {
  console.time("tournaments_list_block_total");
  const t0 = Date.now();
  const parsed = parsePublicTournamentsQuery(sp);
  console.time("tournaments_list_block_common");
  const commonPromise = getCommonPageData("tournaments");
  console.time("tournaments_list_block_data");
  const listPromise = getPublicTournamentsListFromQuery(sp);
  const [{ copy }, { list: initialTournaments }] = await Promise.all([
    commonPromise.finally(() => console.timeEnd("tournaments_list_block_common")),
    listPromise.finally(() => console.timeEnd("tournaments_list_block_data")),
  ]);
  logServerTiming("fetch_tournaments", t0);
  console.timeEnd("tournaments_list_block_total");
  const initialHasMore = initialTournaments.length === parsed.take;
  const c = copy as Record<AdminCopyKey, string>;

  return (
    <PageContentContainer maxWidthClass="max-w-5xl" className="pb-12">
      <TournamentsListWithFilters
        copy={c}
        initialList={initialTournaments}
        initialHasMore={initialHasMore}
        initialQuery={{
          tab: parsed.tab,
          sortBy: parsed.sortBy,
          national: parsed.nationalOnly,
        }}
      />
    </PageContentContainer>
  );
}
