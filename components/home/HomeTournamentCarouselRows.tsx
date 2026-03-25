"use client";

import { useLayoutEffect, useState } from "react";
import {
  HomeTournamentCardItem,
  type HomeTournamentCardModel,
} from "@/components/home/HomeTournamentCardItem";

export type HomeTournamentCarouselInput = Omit<HomeTournamentCardModel, "startAt" | "endAt"> & {
  startAt: Date | string;
  endAt: Date | string | null;
};

function toCardModel(t: HomeTournamentCarouselInput): HomeTournamentCardModel {
  return {
    ...t,
    startAt: typeof t.startAt === "string" ? new Date(t.startAt) : t.startAt,
    endAt: t.endAt ? (typeof t.endAt === "string" ? new Date(t.endAt) : t.endAt) : null,
  };
}

/**
 * 무한 가로 스크롤용 복제 카드는 클라이언트 마운트 후에만 붙여 초기 HTML·hydration 페이로드를 줄인다.
 * prefers-reduced-motion 이면 자동 스크롤이 꺼지므로 복제 생략.
 */
export function HomeTournamentCarouselRows({
  tournaments,
}: {
  tournaments: HomeTournamentCarouselInput[];
}) {
  const [loopDup, setLoopDup] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    setLoopDup(true);
  }, []);

  const normalized = tournaments.map(toCardModel);

  return (
    <ul className="flex w-max min-w-0 flex-nowrap gap-4 px-4 sm:px-6">
      {normalized.map((t) => (
        <HomeTournamentCardItem key={t.id} t={t} />
      ))}
      {loopDup &&
        normalized.map((t) => (
          <HomeTournamentCardItem key={`marq-${t.id}`} t={t} duplicate />
        ))}
    </ul>
  );
}
