"use client";

import { useEffect, useState } from "react";
import {
  HomeTournamentCardItem,
  type HomeTournamentCardModel,
} from "@/components/home/HomeTournamentCardItem";
import type { SlotBlockCtaLayer } from "@/lib/slot-block-cta";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { tournamentGridUlClass, tournamentListRowGapClass } from "@/lib/slot-block-card-style";
import type { SlotBlockLayout } from "@/lib/slot-block-layout-motion";
import { cn } from "@/lib/utils";
import type { PlatformCardTemplateStylePolicy } from "@/lib/platform-card-templates";

export type HomeTournamentCarouselInput = Omit<HomeTournamentCardModel, "startAt" | "endAt"> & {
  startAt: Date | string;
  endAt: Date | string | null;
  /** 직접 구성 카드: 요약·날짜·뱃지 최소 표시 */
  manualSimple?: boolean;
};

const LOOP_DUP_PREPARE_DELAY_MS = 1400;

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
  showDetailButtonByTemplate,
  templateStyleByType,
}: {
  tournaments: HomeTournamentCarouselInput[];
  /** 없으면 기존 캐러셀 한 줄 레이아웃 */
  cardStyle?: SlotBlockCardStyle;
  cardCta?: SlotBlockCtaLayer;
  /** 있으면 `slotBlockLayout` 우선(카드 columns 대신) */
  listLayout?: SlotBlockLayout;
  showDetailButtonByTemplate?: {
    basic: boolean;
    highlight: boolean;
  };
  templateStyleByType?: {
    basic: PlatformCardTemplateStylePolicy;
    highlight: PlatformCardTemplateStylePolicy;
  };
}) {
  const [loopDup, setLoopDup] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = window.setTimeout(() => setLoopDup(true), LOOP_DUP_PREPARE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  const normalized = tournaments.map(toCardModel);
  const useCarousel = listLayout
    ? listLayout.type === "carousel"
    : !cardStyle || cardStyle.columns === "carousel";

  if (!useCarousel && cardStyle) {
    const cols = (listLayout?.type === "grid" ? listLayout.columns : cardStyle.columns) as 1 | 2 | 3 | 4;
    return (
      <ul className={cn(tournamentGridUlClass(cols, cardStyle), "px-4 sm:px-6 w-full max-w-full")}>
        {normalized.map((t, index) => (
          <HomeTournamentCardItem
            key={t.id}
            t={t}
            index={index}
            cardStyle={cardStyle}
            cardCta={cardCta}
            layout="grid"
            showDetailButtonByTemplate={showDetailButtonByTemplate}
            templateStyleByType={templateStyleByType}
          />
        ))}
      </ul>
    );
  }

  const rowGap = cardStyle ? tournamentListRowGapClass(cardStyle) : "gap-4";

  return (
    <ul className={cn("flex w-max min-w-0 flex-nowrap px-4 sm:px-6", rowGap)}>
      {normalized.map((t, index) => (
        <HomeTournamentCardItem
          key={t.id}
          t={t}
          index={index}
          cardStyle={cardStyle}
          cardCta={cardCta}
          layout="carousel"
          showDetailButtonByTemplate={showDetailButtonByTemplate}
          templateStyleByType={templateStyleByType}
        />
      ))}
      {loopDup &&
        normalized.map((t, index) => (
          <HomeTournamentCardItem
            key={`marq-${t.id}`}
            t={t}
            index={index}
            duplicate
            cardStyle={cardStyle}
            cardCta={cardCta}
            layout="carousel"
            showDetailButtonByTemplate={showDetailButtonByTemplate}
            templateStyleByType={templateStyleByType}
          />
        ))}
    </ul>
  );
}
