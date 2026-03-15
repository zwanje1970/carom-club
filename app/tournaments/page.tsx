import Link from "next/link";
import Image from "next/image";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getNoticeBarsForPage, getPopupsForPage, getPageSectionsForPage } from "@/lib/content/service";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTournamentsListRaw, type TournamentListRow } from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST } from "@/lib/mock-data";
import { getServerTiming, logServerTiming } from "@/lib/perf";

export const revalidate = 60;

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

export default async function TournamentsPage() {
  getServerTiming();
  const [copy, noticeBars, popups, pageSections] = await Promise.all([
    getAdminCopy(),
    getNoticeBarsForPage("tournaments"),
    getPopupsForPage("tournaments"),
    getPageSectionsForPage("tournaments"),
  ]);
  logServerTiming("fetch_copy");
  const c = copy as Record<AdminCopyKey, string>;
  let tournaments: TournamentListRow[] = [];
  let useMock = false;

  if (isDatabaseConfigured()) {
    const dbStart = Date.now();
    tournaments = await getTournamentsListRaw({ orderBy: "asc" });
    logServerTiming("db", dbStart);
    if (tournaments.length === 0) {
      tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
      useMock = true;
    }
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    useMock = true;
  }
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
        {tournaments.length === 0 && !useMock ? (
          <div className="mt-12 rounded-xl border border-site-border bg-site-card p-12 text-center">
            <p className="text-gray-600">{getCopyValue(c, "site.tournaments.empty")}</p>
            <p className="mt-2 text-sm text-gray-500">{getCopyValue(c, "site.tournaments.emptyHint")}</p>
          </div>
        ) : (
          <ul className="mt-8 space-y-4 sm:grid sm:grid-cols-1 sm:gap-4 md:grid-cols-2">
            {tournaments.map((t) => {
              const max = t.maxParticipants ?? 0;
              const confirmed = t.confirmedCount ?? 0;
              const remaining = max > 0 ? Math.max(0, max - confirmed) : null;
              const ratio = max > 0 ? confirmed / max : 0;
              const nearlyFull = max > 0 && ratio >= 0.8;
              const almostFull = remaining !== null && remaining > 0 && remaining <= 3;
              const isFull = remaining !== null && remaining <= 0;
              const statusBadge =
                isFull ? "정원 마감" : almostFull ? `마지막 ${remaining}자리` : nearlyFull ? "마감임박" : null;
              return (
                <li key={t.id}>
                  <Link
                    href={`/tournaments/${t.id}`}
                    className="block rounded-xl border border-site-border bg-site-card overflow-hidden shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
                  >
                    {(t.posterImageUrl || t.imageUrl) && (
                      <div className="aspect-[2/1] relative w-full overflow-hidden bg-site-bg">
                        <Image
                          src={(t.posterImageUrl || t.imageUrl)!.trim()}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                          loading="lazy"
                          unoptimized={!(t.posterImageUrl || t.imageUrl)!.trim().startsWith("/")}
                        />
                      </div>
                    )}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="font-semibold text-site-text line-clamp-2">{t.name}</h2>
                        {statusBadge && (
                          <span
                            className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              statusBadge === "마감임박" || statusBadge.startsWith("마지막")
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                : "bg-site-bg text-site-text-muted"
                            }`}
                          >
                            {statusBadge}
                          </span>
                        )}
                      </div>
                      {t.summary && (
                        <p className="mt-1.5 text-sm text-site-text-muted line-clamp-2">{t.summary}</p>
                      )}
                      {t.organization && (
                        <p className="mt-1 text-sm text-site-text-muted">{t.organization.name}</p>
                      )}
                      {t.venue && (
                        <p className="mt-0.5 text-xs text-site-text-muted">장소: {t.venue}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-site-text-muted">{formatDate(t.startAt)}</span>
                        {max > 0 && (
                          <span className="font-medium text-site-text">
                            참가 현황 <span className="text-site-primary">{confirmed}명</span> / {max}명
                          </span>
                        )}
                      </div>
                      {t.gameFormat && (
                        <p className="mt-2 text-xs text-site-text-muted">경기방식: {t.gameFormat}</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
