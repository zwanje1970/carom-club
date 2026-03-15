"use client";

import { useEffect, useState } from "react";
import { HomeTournamentCards } from "./HomeTournamentCards";
import { VenueCarousel } from "./VenueCarousel";
import type { TournamentListRow } from "@/lib/db-tournaments";
import type { VenueCarouselItem } from "./VenueCarousel";

/** 정렬 우선순위: 1) GPS → /api/home/venues·tournaments?lat=&lng= (Haversine), 2) API 내부에서 회원 주소 좌표 사용, 3) 기존 정렬 */

type TournamentItem = TournamentListRow & { distanceKm?: number | null };

type Props = {
  initialTournaments: TournamentListRow[];
  copy: Record<string, string>;
  /** 당구장 소개 캐러셀용 (진행중 대회 다음에 표시) */
  carouselVenues?: VenueCarouselItem[];
};

export function HomeSectionsWithLocation({
  initialTournaments,
  copy,
  carouselVenues = [],
}: Props) {
  const [tournaments, setTournaments] = useState<TournamentItem[]>(
    initialTournaments.map((t) => ({
      ...t,
      startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
      endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
    }))
  );

  useEffect(() => {
    let cancelled = false;

    function fetchWithCoords(lat: number, lng: number) {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), take: "6" });
      fetch(`/api/home/tournaments?${params}`)
        .then((tRes) => {
          if (cancelled) return tRes.json();
          return tRes.json();
        })
        .then((tList: TournamentItem[]) => {
          if (cancelled) return;
          setTournaments(
            (tList || []).map((t) => ({
              ...t,
              startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
              endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
            }))
          );
        });
    }

    function fetchWithoutCoords() {
      fetch("/api/home/tournaments?take=6")
        .then((tRes) => tRes.json())
        .then((tList: TournamentItem[]) => {
          if (cancelled) return;
          setTournaments(
            (tList || []).map((t) => ({
              ...t,
              startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
              endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
            }))
          );
        });
    }

    if (!navigator.geolocation) {
      fetchWithoutCoords();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetch(`/api/auth/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        }).catch(() => {});
        fetchWithCoords(lat, lng);
      },
      () => {
        if (cancelled) return;
        fetchWithoutCoords();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <HomeTournamentCards tournaments={tournaments} copy={copy} />
      {carouselVenues.length > 0 && <VenueCarousel venues={carouselVenues} />}
    </>
  );
}
