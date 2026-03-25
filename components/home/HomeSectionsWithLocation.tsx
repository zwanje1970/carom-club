"use client";

import { useCallback, useState } from "react";
import { HomeTournamentCards } from "./HomeTournamentCards";
import { VenueCarousel } from "./VenueCarousel";
import type { TournamentListRow } from "@/lib/db-tournaments";
import type { VenueCarouselItem } from "./VenueCarousel";

/** 거리순 목록은 버튼 클릭 시에만 geolocation 요청 (로드 직후 권한 팝업 방지) */

type TournamentItem = TournamentListRow & { distanceKm?: number | null };

type Props = {
  initialTournaments: TournamentListRow[];
  copy: Record<string, string>;
  carouselVenues?: VenueCarouselItem[];
  homeCarouselFlowSpeed?: number;
};

export function HomeSectionsWithLocation({
  initialTournaments,
  copy,
  carouselVenues = [],
  homeCarouselFlowSpeed = 50,
}: Props) {
  const [tournaments, setTournaments] = useState<TournamentItem[]>(
    initialTournaments.map((t) => ({
      ...t,
      startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
      endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
    }))
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const handleFindNearby = useCallback(() => {
    setNearbyError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNearbyError("이 기기에서는 위치를 사용할 수 없습니다.");
      return;
    }
    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetch(`/api/auth/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        }).catch(() => {});
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), take: "6" });
        fetch(`/api/home/tournaments?${params}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch"))))
          .then((tList: TournamentItem[]) => {
            setTournaments(
              (tList || []).map((t) => ({
                ...t,
                startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
                endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
              }))
            );
          })
          .catch(() => setNearbyError("목록을 불러오지 못했습니다."))
          .finally(() => setNearbyLoading(false));
      },
      () => {
        setNearbyError("위치 권한이 필요합니다. 버튼을 다시 누르고 허용해 주세요.");
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 }
    );
  }, []);

  return (
    <>
      <HomeTournamentCards
        tournaments={tournaments}
        copy={copy}
        homeCarouselFlowSpeed={homeCarouselFlowSpeed}
        nearbyFind={{
          onClick: handleFindNearby,
          loading: nearbyLoading,
          error: nearbyError,
        }}
      />
      {carouselVenues.length > 0 && (
        <VenueCarousel venues={carouselVenues} homeCarouselFlowSpeed={homeCarouselFlowSpeed} />
      )}
    </>
  );
}
