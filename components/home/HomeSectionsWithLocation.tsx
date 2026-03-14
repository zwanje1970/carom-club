"use client";

import { useEffect, useState } from "react";
import { HomeTournamentCards } from "./HomeTournamentCards";
import { HomeVenueCards } from "./HomeVenueCards";
import type { TournamentListRow } from "@/lib/db-tournaments";

/** 정렬 우선순위: 1) GPS → /api/home/venues·tournaments?lat=&lng= (Haversine), 2) API 내부에서 회원 주소 좌표 사용, 3) 기존 정렬 */

type VenueItem = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  distanceKm?: number | null;
};

type TournamentItem = TournamentListRow & { distanceKm?: number | null };

type Props = {
  initialVenues: { id: string; name: string; slug: string }[];
  initialTournaments: TournamentListRow[];
  copy: Record<string, string>;
};

export function HomeSectionsWithLocation({
  initialVenues,
  initialTournaments,
  copy,
}: Props) {
  const [venues, setVenues] = useState<VenueItem[]>(
    initialVenues.map((v) => ({ ...v, coverImageUrl: (v as VenueItem).coverImageUrl ?? null }))
  );
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
      Promise.all([
        fetch(`/api/home/venues?${params}`),
        fetch(`/api/home/tournaments?${params}`),
      ]).then(([vRes, tRes]) => {
        if (cancelled) return;
        vRes.json().then((vList: VenueItem[]) => setVenues(vList));
        tRes.json().then((tList: TournamentItem[]) => {
          setTournaments(
            tList.map((t) => ({
              ...t,
              startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
              endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
            }))
          );
        });
      });
    }

    function fetchWithoutCoords() {
      Promise.all([
        fetch("/api/home/venues?take=6"),
        fetch("/api/home/tournaments?take=6"),
      ]).then(([vRes, tRes]) => {
        if (cancelled) return;
        vRes.json().then((vList: VenueItem[]) => setVenues(vList));
        tRes.json().then((tList: TournamentItem[]) => {
          setTournaments(
            tList.map((t) => ({
              ...t,
              startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
              endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
            }))
          );
        });
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
      <HomeVenueCards venues={venues} copy={copy} />
    </>
  );
}
