import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { HomeTournamentListAutoScroll } from "@/components/home/HomeTournamentListAutoScroll";
import { HomeTournamentCarouselRows } from "@/components/home/HomeTournamentCarouselRows";
import type { HomeTournamentCarouselInput } from "@/components/home/HomeTournamentCarouselRows";

export function HomeTournamentCards({
  tournaments,
  copy,
  homeCarouselFlowSpeed = 50,
}: {
  tournaments: HomeTournamentCarouselInput[];
  copy: Record<string, string>;
  /** 메인 가로 흐름 속도(1~100) */
  homeCarouselFlowSpeed?: number;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  if (tournaments.length === 0) {
    return (
      <section className="px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">
            {getCopyValue(c, "site.home.tournaments.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {getCopyValue(c, "site.home.tournaments.subtitleEmpty")}
          </p>
          <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
            <p className="text-gray-500">{getCopyValue(c, "site.home.tournaments.empty")}</p>
            <Link
              href="/tournaments"
              className="mt-4 inline-block rounded-xl bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {getCopyValue(c, "site.home.tournaments.btnList")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-site-text sm:text-2xl">
              {getCopyValue(c, "site.home.tournaments.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {getCopyValue(c, "site.home.tournaments.subtitle")}
            </p>
          </div>
          <Link
            href="/tournaments"
            className="shrink-0 text-sm font-medium text-site-primary hover:underline"
          >
            전체보기 →
          </Link>
        </div>
        <HomeTournamentListAutoScroll flowSpeed={homeCarouselFlowSpeed}>
          <HomeTournamentCarouselRows tournaments={tournaments} />
        </HomeTournamentListAutoScroll>
      </div>
    </section>
  );
}
