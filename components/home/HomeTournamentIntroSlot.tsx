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
      nearbyFind={{
        onClick: handleFindNearby,
        loading: nearbyLoading,
        error: nearbyError,
      }}
    />
  );
}
