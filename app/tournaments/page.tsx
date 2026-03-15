import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { TournamentsListWithFilters } from "@/components/tournaments/TournamentsListWithFilters";
import { getServerTiming, logServerTiming } from "@/lib/perf";

export const revalidate = 60;

export default async function TournamentsPage() {
  getServerTiming();
  const common = await getCommonPageData("tournaments");
  const { copy, noticeBars, popups, pageSections } = common;
  logServerTiming("fetch_copy");
  const c = copy as Record<AdminCopyKey, string>;
  const useMock = !isDatabaseConfigured();
  logServerTiming("page");

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={pageSections} />
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-site-text">{getCopyValue(c, "site.tournaments.title")}</h1>
        <p className="mt-2 text-gray-600">{getCopyValue(c, "site.tournaments.subtitle")}</p>

        {useMock && (
          <p className="mt-4 text-center text-sm text-site-primary">DB 없이 미리보기 데이터로 표시 중입니다.</p>
        )}

        <TournamentsListWithFilters copy={c} useMock={useMock} />
      </div>
    </main>
  );
}
