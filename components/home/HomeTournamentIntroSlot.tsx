"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HomeTournamentCards } from "@/components/home/HomeTournamentCards";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import type { HomePublishedTournamentCard, HomeTournamentSortBy } from "@/lib/home-published-tournament-cards";
import type { SlotBlockTournamentListSettings } from "@/lib/slot-block-tournament-list";

type TournamentItem = HomePublishedTournamentCard;

/** 홈 `tournamentIntro` 슬롯 — `PageSlotBlock`에서만 마운트 */
export function HomeTournamentIntroSlot({
  initialTournaments,
  copy,
  cardStyle,
  ctaConfig,
  slotLayout,
  slotMotion,
  blockBackgroundColor,
  homeCarouselFlowSpeed,
  listSettings,
  sectionTitle,
  sectionSubtitle,
}: {
  initialTournaments: HomePublishedTournamentCard[];
  copy: Record<string, string>;
  cardStyle?: SlotBlockCardStyle;
  ctaConfig: SlotBlockCtaConfig;
  slotLayout: SlotBlockLayout;
  slotMotion: SlotBlockMotion;
  blockBackgroundColor?: string;
  homeCarouselFlowSpeed: number;
  listSettings: SlotBlockTournamentListSettings;
  /** `PageSection` 제목·부제(페이지 빌더·CMS 행) */
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
}) {
  const [activeSort, setActiveSort] = useState<HomeTournamentSortBy>(listSettings.sortBy);
  const [sortMap, setSortMap] = useState<Record<HomeTournamentSortBy, TournamentItem[]>>({
    latest: initialTournaments,
    deadline: [],
    distance: [],
  });
  const [sortLoading, setSortLoading] = useState<HomeTournamentSortBy | null>(null);
  const [tournaments, setTournaments] = useState<TournamentItem[]>(initialTournaments);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  useEffect(() => {
    setActiveSort(listSettings.sortBy);
  }, [listSettings.sortBy]);

  const loadBySort = useCallback(
    async (sortBy: HomeTournamentSortBy, params?: { lat?: number; lng?: number }) => {
      setSortLoading(sortBy);
      const query = new URLSearchParams({
        sortBy,
        take: String(listSettings.displayCount),
      });
      if (params?.lat != null && params?.lng != null) {
        query.set("lat", String(params.lat));
        query.set("lng", String(params.lng));
      }
      try {
        const res = await fetch(`/api/home/tournaments?${query.toString()}`);
        if (!res.ok) throw new Error("fetch");
        const list = (await res.json()) as TournamentItem[];
        setSortMap((prev) => ({ ...prev, [sortBy]: list }));
        return list;
      } finally {
        setSortLoading((prev) => (prev === sortBy ? null : prev));
      }
    },
    [listSettings.displayCount]
  );

  const handleFindNearby = useCallback(() => {
    const c = copy as Record<AdminCopyKey, string>;
    setNearbyError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNearbyError(getCopyValue(c, "site.home.tournaments.nearbyErrorGeolocation"));
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
        loadBySort("distance", { lat, lng })
          .then((list) => {
            setTournaments(list);
            setActiveSort("distance");
          })
          .catch(() => setNearbyError(getCopyValue(c, "site.home.tournaments.nearbyErrorFetch")))
          .finally(() => setNearbyLoading(false));
      },
      () => {
        setNearbyError(getCopyValue(c, "site.home.tournaments.nearbyErrorPermission"));
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 }
    );
  }, [copy, loadBySort]);

  useEffect(() => {
    const initialTake = initialTournaments.slice(0, listSettings.displayCount);
    setSortMap({
      latest: initialTake,
      deadline: [],
      distance: [],
    });
    if (listSettings.sortBy === "latest") {
      setTournaments(initialTake);
      return;
    }
    setTournaments([]);
    void loadBySort(listSettings.sortBy)
      .then((selected) => setTournaments(selected))
      .catch(() => {
        setTournaments([]);
      });
  }, [initialTournaments, listSettings.displayCount, listSettings.sortBy, loadBySort]);

  const tabs = useMemo(
    () => [
      { id: "latest" as const, label: "최신순" },
      { id: "deadline" as const, label: "마감임박" },
      { id: "distance" as const, label: "위치순" },
    ],
    []
  );

  const handleTabChange = useCallback(
    (next: HomeTournamentSortBy) => {
      setActiveSort(next);
      const existing = sortMap[next];
      if (existing.length > 0) {
        setTournaments(existing);
        return;
      }
      void loadBySort(next).then((list) => setTournaments(list));
    },
    [loadBySort, sortMap]
  );

  return (
    <HomeTournamentCards
      tournaments={tournaments}
      copy={copy}
      cardStyle={cardStyle}
      ctaConfig={ctaConfig}
      slotLayout={slotLayout}
      slotMotion={{ ...slotMotion, autoPlay: listSettings.slideEnabled && slotMotion.autoPlay }}
      blockBackgroundColor={blockBackgroundColor}
      homeCarouselFlowSpeed={homeCarouselFlowSpeed}
      sectionTitle={sectionTitle}
      sectionSubtitle={sectionSubtitle}
      showMoreButton={listSettings.showMoreButton}
      sortTabs={{
        items: tabs,
        active: activeSort,
        loading: sortLoading,
        onChange: handleTabChange,
      }}
      nearbyFind={{
        onClick: handleFindNearby,
        loading: nearbyLoading,
        error: nearbyError,
      }}
    />
  );
}
