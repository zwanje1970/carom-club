import Link from "next/link";
import Image from "next/image";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { formatDistanceKm } from "@/lib/distance";

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
    <section className="px-4 py-10 sm:px-6 sm:py-12">
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
            className="text-sm font-medium text-site-primary hover:underline"
          >
            {getCopyValue(c, "site.home.venues.btnViewAll")}
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <li key={v.id}>
              <Link
                href={`/v/${v.slug}`}
                className="group flex overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm transition hover:border-site-secondary/50 hover:shadow-md"
              >
                {/* 좌측 절반: 텍스트 (상자 안 여백 없이 패딩만 텍스트 영역) */}
                <div className="flex flex-1 flex-col justify-center p-4 min-w-0">
                  <h3 className="font-semibold text-site-text group-hover:text-site-primary truncate">
                    {v.name}
                  </h3>
                  {v.distanceKm != null && (
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDistanceKm(v.distanceKm)}
                    </p>
                  )}
                  <p className="mt-0.5 text-sm text-gray-500">자세히 보기 →</p>
                </div>
                {/* 우측 절반: 이미지 (클라이언트 등록 cover, 정비율 object-cover로 크기 최적화) */}
                <div className="relative w-1/2 shrink-0 aspect-square bg-gray-200 dark:bg-slate-700">
                  {v.coverImageUrl ? (
                    <Image
                      src={v.coverImageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-3xl text-site-secondary/50" aria-hidden>
                      ●
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
