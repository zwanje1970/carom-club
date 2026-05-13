"use client";

import { createContext, useContext } from "react";

export type TournamentsListDetailTransitionContextValue = {
  signalForwardIntent: () => void;
  signalBackIntent: () => void;
  /** 목록에서 상세로 갈 때: 탭 직후 슬라이드·플레이스홀더용(호출부에서 `flushSync` 권장) */
  beginForwardOpening: (targetHref: string) => void;
};

export const TournamentsListDetailTransitionContext =
  createContext<TournamentsListDetailTransitionContextValue | null>(null);

export function useTournamentsListDetailTransition(): TournamentsListDetailTransitionContextValue | null {
  return useContext(TournamentsListDetailTransitionContext);
}
