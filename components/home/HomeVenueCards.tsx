import Link from "next/link";
import Image from "next/image";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { formatDistanceKm } from "@/lib/distance";
import { isOptimizableImageSrc } from "@/lib/image-src";

type Venue = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  distanceKm?: number | null;
};

export function HomeVenueCards({
  venues,
  copy,
}: {
  venues: Venue[];
  copy: Record<string, string>;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  if (venues.length === 0) {
    return (
      <section className="px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">
            {getCopyValue(c, "site.home.venues.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {getCopyValue(c, "site.home.venues.subtitle")}
          </p>
          <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
            <p className="text-gray-500">{getCopyValue(c, "site.home.venues.empty")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-site-text sm:text-2xl">
              {getCopyValue(c, "site.home.venues.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {getCopyValue(c, "site.home.venues.subtitleWithList")}
            </p>
          </div>
          <Link
            href="/venues"
            className="text-sm font-medium text-site-primary hover:underline shrink-0"
          >
            {getCopyValue(c, "site.home.venues.btnViewAll")}
          </Link>
        </div>
        {/* 모바일: 세로 스와이프 리스트 (고정 높이) / PC: 그리드 */}
        <div
          className="mt-4 md:mt-6 h-[420px] md:h-auto overflow-y-auto overflow-x-hidden snap-y snap-mandatory touch-pan-y md:overflow-visible md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <ul className="flex flex-col gap-3 md:contents">
            {venues.map((v) => (
              <li key={v.id} className="shrink-0 snap-start">
                <Link
                  href={`/v/${v.slug}`}
                  className="group flex overflow-hidden rounded-xl border border-site-border bg-white shadow-sm transition hover:border-site-secondary/50 hover:shadow-md h-[180px] md:h-auto md:rounded-2xl md:bg-site-card md:shadow-sm"
                >
                  <div className="flex flex-1 flex-col justify-center p-3 min-w-0">
                    <h3 className="font-semibold text-site-text group-hover:text-site-primary truncate text-sm md:text-base">
                      {v.name}
                    </h3>
                    {v.distanceKm != null && (
                      <p className="mt-0.5 text-xs text-gray-500 md:text-sm">
                        {formatDistanceKm(v.distanceKm)}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-500 md:text-sm">자세히 보기 →</p>
                  </div>
                  <div className="relative w-1/2 shrink-0 aspect-square bg-gray-200 dark:bg-slate-700 md:aspect-square">
                    {v.coverImageUrl?.trim() ? (
                      (() => {
                        const src = v.coverImageUrl!.trim();
                        if (!src) return null;
                        return isOptimizableImageSrc(src) ? (
                          <Image
                            src={src}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"
                            className="object-cover"
                          />
                        ) : (
                          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        );
                      })()
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-2xl text-site-secondary/50 md:text-3xl" aria-hidden>
                        ●
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
