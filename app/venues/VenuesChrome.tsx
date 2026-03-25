import Link from "next/link";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { getServerTiming, logServerTiming } from "@/lib/perf";

/** 상단 공통·제목만 먼저 스트리밍 */
export async function VenuesChrome() {
  getServerTiming();
  const t0 = Date.now();
  const { copy, noticeBars, popups, pageSections } = await getCommonPageData("venues");
  logServerTiming("fetch_copy", t0);
  const c = copy as Record<AdminCopyKey, string>;

  return (
    <>
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={pageSections} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-site-text">
          ← 홈
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-site-text">{getCopyValue(c, "site.venues.title")}</h1>
        <p className="mt-2 text-gray-600">{getCopyValue(c, "site.venues.subtitle")}</p>
        <p className="mt-1 text-sm text-gray-500">위치를 허용하면 가까운 당구장부터 볼 수 있습니다.</p>
      </div>
    </>
  );
}
