import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { HomeTournamentListAutoScroll } from "@/components/home/HomeTournamentListAutoScroll";
import { HomeTournamentCarouselRows } from "@/components/home/HomeTournamentCarouselRows";
import type { HomeTournamentCarouselInput } from "@/components/home/HomeTournamentCarouselRows";

export function HomeTournamentCards({
  tournaments,
  copy,
  homeCarouselFlowSpeed = 50,
  nearbyFind,
}: {
  tournaments: HomeTournamentCarouselInput[];
  copy: Record<string, string>;
  homeCarouselFlowSpeed?: number;
  /** 클릭 시에만 위치 권한 요청 */
  nearbyFind?: { onClick: () => void; loading: boolean; error: string | null };
}) {
  const c = copy as Record<AdminCopyKey, string>;
  if (tournaments.length === 0) {
    return (
      <section className="px-4 py-10 sm:px-6 sm:py-12 min-h-[320px]">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">
            {getCopyValue(c, "site.home.tournaments.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {getCopyValue(c, "site.home.tournaments.subtitleEmpty")}
          </p>
          {nearbyFind?.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {nearbyFind.error}
            </p>
          )}
          <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
            <p className="text-gray-500">{getCopyValue(c, "site.home.tournaments.empty")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {nearbyFind && (
                <button
                  type="button"
                  onClick={nearbyFind.onClick}
                  disabled={nearbyFind.loading}
                  className="rounded-xl border border-site-border bg-site-bg px-5 py-2.5 text-sm font-medium text-site-text hover:border-site-primary/50 disabled:opacity-60"
                >
                  {nearbyFind.loading ? "위치 확인 중…" : "내 주변 대회 찾기"}
                </button>
              )}
              <Link
                href="/tournaments"
                className="inline-block rounded-xl bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                {getCopyValue(c, "site.home.tournaments.btnList")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12 min-h-[380px]">
      <div className="mx-auto max-w-5xl min-h-[inherit]">
        <div className="flex flex-wrap items-end justify-between gap-2 gap-y-3">
          <div className="min-h-[4.5rem] min-w-0 flex-1">
            <h2 className="text-xl font-bold text-site-text sm:text-2xl min-h-[1.75rem]">
              {getCopyValue(c, "site.home.tournaments.title")}
            </h2>
            <p className="mt-1 min-h-[2.5rem] text-sm text-gray-600 line-clamp-2">
              {getCopyValue(c, "site.home.tournaments.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 min-h-[44px]">
            {nearbyFind && (
              <button
                type="button"
                onClick={nearbyFind.onClick}
                disabled={nearbyFind.loading}
                className="rounded-lg border border-site-border bg-site-card px-3 py-2 text-sm font-medium text-site-text hover:border-site-primary/50 disabled:opacity-60"
              >
                {nearbyFind.loading ? "위치 확인 중…" : "내 주변 대회 찾기"}
              </button>
            )}
            <Link
              href="/tournaments"
              className="inline-flex items-center text-sm font-medium text-site-primary hover:underline py-2"
            >
              전체보기 →
            </Link>
          </div>
        </div>
        {nearbyFind?.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {nearbyFind.error}
          </p>
        )}
        <HomeTournamentListAutoScroll flowSpeed={homeCarouselFlowSpeed}>
          <HomeTournamentCarouselRows tournaments={tournaments} />
        </HomeTournamentListAutoScroll>
      </div>
    </section>
  );
}
