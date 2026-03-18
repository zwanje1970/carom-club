"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sanitizeImageSrc } from "@/lib/image-src";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { formatDistanceKm } from "@/lib/distance";

const VENUE_CATEGORY_OPTIONS: { value: "all" | "daedae_only" | "mixed"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "daedae_only", label: "대대전용구장" },
  { value: "mixed", label: "복합구장" },
];

type VenueItem = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  distanceKm?: number | null;
  venueCategory?: "daedae_only" | "mixed" | null;
};

type Props = {
  initialVenues: { id: string; name: string; slug: string; venueCategory?: "daedae_only" | "mixed" | null }[];
  copy: Record<string, string>;
};

/** 당구장 목록: 기본 목록 즉시 표시, 위치 허용 시 가까운 순으로 후처리, 대대전용/복합구장 필터. */
export function VenuesListWithLocation({ initialVenues, copy }: Props) {
  const [venues, setVenues] = useState<VenueItem[]>(
    initialVenues.map((v) => ({ ...v, coverImageUrl: null }))
  );
  const [venueFilter, setVenueFilter] = useState<"all" | "daedae_only" | "mixed">("all");
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationRefining, setLocationRefining] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const filteredVenues =
    venueFilter === "all"
      ? venues
      : venues.filter((v) => v.venueCategory === venueFilter);

  useEffect(() => {
    let cancelled = false;

    function fetchWithCoords(lat: number, lng: number) {
      setLocationRefining(true);
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), take: "100" });
      fetch(`/api/home/venues?${params}`)
        .then((r) => r.json())
        .then((list: VenueItem[]) => {
          if (cancelled) return;
          setVenues(list);
          setSortByDistance(list.some((v) => v.distanceKm != null));
        })
        .finally(() => {
          if (!cancelled) setLocationRefining(false);
        });
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        if (cancelled) return;
        setLocationError(true);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );

    return () => {
      cancelled = true;
    };
  }, [initialVenues.length]);

  const c = copy as Record<AdminCopyKey, string>;

  if (venues.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-site-border bg-site-card p-10 text-center">
        <p className="text-gray-500">{getCopyValue(c, "site.venues.empty")}</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-site-text">찾기:</span>
        {VENUE_CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setVenueFilter(opt.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              venueFilter === opt.value
                ? "border-site-primary bg-site-primary/15 text-site-primary"
                : "border-site-border bg-site-card text-site-text hover:border-site-secondary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {venueFilter !== "all" && filteredVenues.length === 0 && (
        <p className="text-sm text-gray-500">해당 조건의 당구장이 없습니다.</p>
      )}
      {locationRefining && (
        <p className="text-sm text-gray-500">가까운 순으로 정렬 중…</p>
      )}
      {!locationRefining && sortByDistance && (
        <p className="text-sm font-medium text-site-primary">가까운 순으로 보여드립니다.</p>
      )}
      {!locationRefining && !sortByDistance && locationError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          위치를 허용하면 가까운 당구장부터 볼 수 있습니다. 이름 순으로 표시 중입니다.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVenues.map((v) => (
          <li key={v.id}>
            <Link
              href={`/v/${v.slug}`}
              className="flex overflow-hidden rounded-2xl border border-site-border bg-site-card p-5 shadow-sm transition hover:border-site-secondary/50 hover:shadow-md"
            >
              <span className="text-2xl text-site-secondary/80 shrink-0">●</span>
              <div className="ml-3 flex-1 min-w-0">
                <h2 className="font-semibold text-site-text">{v.name}</h2>
                {v.distanceKm != null && (
                  <p className="mt-0.5 text-sm text-site-primary">{formatDistanceKm(v.distanceKm)}</p>
                )}
                <p className="mt-0.5 text-sm text-gray-500">자세히 보기 →</p>
              </div>
              {(() => {
                const src = sanitizeImageSrc(v.coverImageUrl);
                if (!src) return null;
                return (
                  <div className="relative ml-3 h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={src}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      data-debug-src={src}
                    />
                  </div>
                );
              })()}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
