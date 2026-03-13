import Link from "next/link";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getNoticeBarsForPage, getPopupsForPage, getPageSectionsForPage } from "@/lib/content/service";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTournamentsListRaw, type TournamentListRow } from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

export default async function TournamentsPage() {
  const [copy, noticeBars, popups, pageSections] = await Promise.all([
    getAdminCopy(),
    getNoticeBarsForPage("tournaments"),
    getPopupsForPage("tournaments"),
    getPageSectionsForPage("tournaments"),
  ]);
  const c = copy as Record<AdminCopyKey, string>;
  let tournaments: TournamentListRow[] = [];
  let useMock = false;

  if (isDatabaseConfigured()) {
    tournaments = await getTournamentsListRaw({ orderBy: "asc" });
    if (tournaments.length === 0) {
      tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
      useMock = true;
    }
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    useMock = true;
  }

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
        {tournaments.length === 0 && !useMock ? (
          <div className="mt-12 rounded-xl border border-site-border bg-site-card p-12 text-center">
            <p className="text-gray-600">{getCopyValue(c, "site.tournaments.empty")}</p>
            <p className="mt-2 text-sm text-gray-500">{getCopyValue(c, "site.tournaments.emptyHint")}</p>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="block rounded-xl border border-site-border bg-site-card p-6 shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-site-text">{t.name}</h2>
                      {t.organization && (
                        <p className="mt-1 text-sm text-gray-600">{t.organization.name}</p>
                      )}
                      {t.venue && (
                        <p className="mt-1 text-sm text-gray-500">장소: {t.venue}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{formatDate(t.startAt)}</p>
                      {t.endAt && <p>{formatDate(t.endAt)}</p>}
                    </div>
                  </div>
                  {t.gameFormat && (
                    <p className="mt-3 text-sm text-gray-500">경기방식: {t.gameFormat}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
