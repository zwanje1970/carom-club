"use client";

import { createContext, useContext } from "react";

export type TournamentsListDetailTransitionContextValue = {
  signalForwardIntent: () => void;
  signalBackIntent: () => void;
};

export const TournamentsListDetailTransitionContext =
  createContext<TournamentsListDetailTransitionContextValue | null>(null);

export function useTournamentsListDetailTransition(): TournamentsListDetailTransitionContextValue | null {
  return useContext(TournamentsListDetailTransitionContext);
}
