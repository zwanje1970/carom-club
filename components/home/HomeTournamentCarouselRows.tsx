"use client";

import { useLayoutEffect, useState } from "react";
import {
  HomeTournamentCardItem,
  type HomeTournamentCardModel,
} from "@/components/home/HomeTournamentCardItem";
import type { SlotBlockCtaLayer } from "@/lib/slot-block-cta";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { tournamentGridUlClass, tournamentListRowGapClass } from "@/lib/slot-block-card-style";
import type { SlotBlockLayout } from "@/lib/slot-block-layout-motion";
import { cn } from "@/lib/utils";

export type HomeTournamentCarouselInput = Omit<HomeTournamentCardModel, "startAt" | "endAt"> & {
  startAt: Date | string;
  endAt: Date | string | null;
  /** 직접 구성 카드: 요약·날짜·뱃지 최소 표시 */
  manualSimple?: boolean;
};

function toCardModel(t: HomeTournamentCarouselInput): HomeTournamentCardModel {
  return {
    ...t,
    startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
    endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
    manualSimple: t.manualSimple,
    directCardHref: t.directCardHref,
  };
}

/**
 * 무한 가로 스크롤용 복제 카드는 클라이언트 마운트 후에만 붙여 초기 HTML·hydration 페이로드를 줄인다.
 * prefers-reduced-motion 이면 자동 스크롤이 꺼지므로 복제 생략.
 */
export function HomeTournamentCarouselRows({
  tournaments,
  cardStyle,
  cardCta,
  listLayout,
}: {
  tournaments: HomeTournamentCarouselInput[];
  /** 없으면 기존 캐러셀 한 줄 레이아웃 */
  cardStyle?: SlotBlockCardStyle;
  cardCta?: SlotBlockCtaLayer;
  /** 있으면 `slotBlockLayout` 우선(카드 columns 대신) */
  listLayout?: SlotBlockLayout;
}) {
  const [loopDup, setLoopDup] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    setLoopDup(true);
  }, []);

  const normalized = tournaments.map(toCardModel);
  const useCarousel = listLayout
    ? listLayout.type === "carousel"
    : !cardStyle || cardStyle.columns === "carousel";

  if (!useCarousel && cardStyle) {
    const cols = (listLayout?.type === "grid" ? listLayout.columns : cardStyle.columns) as 1 | 2 | 3 | 4;
    return (
      <ul className={cn(tournamentGridUlClass(cols, cardStyle), "px-4 sm:px-6 w-full max-w-full")}>
        {normalized.map((t) => (
          <HomeTournamentCardItem key={t.id} t={t} cardStyle={cardStyle} cardCta={cardCta} layout="grid" />
        ))}
      </ul>
    );
  }

  const rowGap = cardStyle ? tournamentListRowGapClass(cardStyle) : "gap-4";

  return (
    <ul className={cn("flex w-max min-w-0 flex-nowrap px-4 sm:px-6", rowGap)}>
      {normalized.map((t) => (
        <HomeTournamentCardItem key={t.id} t={t} cardStyle={cardStyle} cardCta={cardCta} layout="carousel" />
      ))}
      {loopDup &&
        normalized.map((t) => (
          <HomeTournamentCardItem
            key={`marq-${t.id}`}
            t={t}
            duplicate
            cardStyle={cardStyle}
            cardCta={cardCta}
            layout="carousel"
          />
        ))}
    </ul>
  );
}
