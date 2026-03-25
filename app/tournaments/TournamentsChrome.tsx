import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { logServerTiming } from "@/lib/perf";

export async function TournamentsChrome() {
  const t0 = Date.now();
  const { copy, noticeBars, popups, pageSections } = await getCommonPageData("tournaments");
  logServerTiming("fetch_copy", t0);
  const c = copy as Record<AdminCopyKey, string>;

  return (
    <>
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={pageSections} />
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold text-site-text">{getCopyValue(c, "site.tournaments.title")}</h1>
        <p className="mt-2 text-gray-600">{getCopyValue(c, "site.tournaments.subtitle")}</p>
      </div>
    </>
  );
}
