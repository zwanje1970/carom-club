"use client";

import { useCallback, useState } from "react";
import { HomeTournamentCards } from "@/components/home/HomeTournamentCards";
import type { HomeTournamentCarouselInput } from "@/components/home/HomeTournamentCarouselRows";
import type { TournamentListRow } from "@/lib/db-tournaments";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import type { SlotBlockItemsBundle } from "@/lib/slot-block-items";
import { manualItemsToTournamentCarouselInput } from "@/lib/slot-block-items";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

type TournamentItem = TournamentListRow & { distanceKm?: number | null };

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
  slotItems,
  sectionTitle,
  sectionSubtitle,
}: {
  initialTournaments: TournamentListRow[];
  copy: Record<string, string>;
  cardStyle?: SlotBlockCardStyle;
  ctaConfig: SlotBlockCtaConfig;
  slotLayout: SlotBlockLayout;
  slotMotion: SlotBlockMotion;
  blockBackgroundColor?: string;
  homeCarouselFlowSpeed: number;
  slotItems: SlotBlockItemsBundle;
  /** `PageSection` 제목·부제(페이지 빌더·CMS 행) */
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
}) {
  const useManualContent = slotItems.mode === "manual";

  const [tournaments, setTournaments] = useState<TournamentItem[]>(() =>
    initialTournaments.map((t) => ({
      ...t,
      startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
      endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
    }))
  );
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

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
          .catch(() => setNearbyError(getCopyValue(c, "site.home.tournaments.nearbyErrorFetch")))
          .finally(() => setNearbyLoading(false));
      },
      () => {
        setNearbyError(getCopyValue(c, "site.home.tournaments.nearbyErrorPermission"));
        setNearbyLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600_000 }
    );
  }, [copy]);

  const manualList: HomeTournamentCarouselInput[] = useManualContent
    ? manualItemsToTournamentCarouselInput(slotItems.items)
    : [];

  if (useManualContent) {
    return (
      <HomeTournamentCards
        tournaments={manualList}
        copy={copy}
        cardStyle={cardStyle}
        ctaConfig={ctaConfig}
        slotLayout={slotLayout}
        slotMotion={slotMotion}
        blockBackgroundColor={blockBackgroundColor}
        homeCarouselFlowSpeed={homeCarouselFlowSpeed}
        sectionTitle={sectionTitle}
        sectionSubtitle={sectionSubtitle}
      />
    );
  }

  return (
    <HomeTournamentCards
      tournaments={tournaments}
      copy={copy}
      cardStyle={cardStyle}
      ctaConfig={ctaConfig}
      slotLayout={slotLayout}
      slotMotion={slotMotion}
      blockBackgroundColor={blockBackgroundColor}
      homeCarouselFlowSpeed={homeCarouselFlowSpeed}
      sectionTitle={sectionTitle}
      sectionSubtitle={sectionSubtitle}
      nearbyFind={{
        onClick: handleFindNearby,
        loading: nearbyLoading,
        error: nearbyError,
      }}
    />
  );
}
