import Link from "next/link";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { VenuesListWithLocation } from "@/components/venues/VenuesListWithLocation";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getNoticeBarsForPage, getPopupsForPage, getPageSectionsForPage } from "@/lib/content/service";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";
import { getServerTiming, logServerTiming } from "@/lib/perf";

export const revalidate = 60;

export default async function VenuesPage() {
  getServerTiming();
  const [copy, noticeBars, popups, pageSections] = await Promise.all([
    getAdminCopy(),
    getNoticeBarsForPage("venues"),
    getPopupsForPage("venues"),
    getPageSectionsForPage("venues"),
  ]);
  logServerTiming("fetch_copy");
  const c = copy as Record<AdminCopyKey, string>;
  let venues: { id: string; name: string; slug: string }[] = [];

  const dbStart = Date.now();
  if (isDatabaseConfigured()) {
    try {
      const approvedApplicantIds = await prisma.clientApplication
        .findMany({
          where: { status: "APPROVED" },
          select: { applicantUserId: true },
          distinct: ["applicantUserId"],
        })
        .then((rows) => rows.map((r) => r.applicantUserId).filter((id): id is string => id != null));
      venues = await prisma.organization.findMany({
        where: {
          type: "VENUE",
          ownerUserId: { in: approvedApplicantIds },
        },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      });
    } catch {
      venues = MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
    }
  } else {
    venues = MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
  }
  logServerTiming("db", dbStart);
  logServerTiming("page");

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={pageSections} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-site-text">
          ← 홈
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-site-text">{getCopyValue(c, "site.venues.title")}</h1>
        <p className="mt-2 text-gray-600">{getCopyValue(c, "site.venues.subtitle")}</p>
        <p className="mt-1 text-sm text-gray-500">위치를 허용하면 가까운 당구장부터 볼 수 있습니다.</p>

        {venues.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-site-border bg-site-card p-10 text-center">
            <p className="text-gray-500">{getCopyValue(c, "site.venues.empty")}</p>
          </div>
        ) : (
          <VenuesListWithLocation initialVenues={venues} copy={copy} />
        )}
      </div>
    </main>
  );
}
