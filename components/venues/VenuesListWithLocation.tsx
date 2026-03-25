"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
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
  const [locationError, setLocationError] = useState<string | null>(null);

  const filteredVenues =
    venueFilter === "all"
      ? venues
      : venues.filter((v) => v.venueCategory === venueFilter);

  const requestNearbyVenues = useCallback(() => {
    setLocationError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("이 기기에서는 위치를 사용할 수 없습니다.");
      return;
    }
    setLocationRefining(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), take: "100" });
        fetch(`/api/home/venues?${params}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch"))))
          .then((list: VenueItem[]) => {
            setVenues(list);
            setSortByDistance(list.some((v) => v.distanceKm != null));
          })
          .catch(() => setLocationError("목록을 불러오지 못했습니다."))
          .finally(() => setLocationRefining(false));
      },
      () => {
        setLocationError("위치 권한이 필요합니다. 버튼을 다시 누르고 허용해 주세요.");
        setLocationRefining(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 }
    );
  }, []);

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
        <button
          type="button"
          onClick={requestNearbyVenues}
          disabled={locationRefining}
          className="rounded-lg border border-site-border bg-site-card px-3 py-1.5 text-sm font-medium text-site-text hover:border-site-primary/50 disabled:opacity-60"
        >
          {locationRefining ? "위치 확인 중…" : "내 주변 당구장"}
        </button>
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
      {locationError && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          role="alert"
        >
          {locationError}
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
