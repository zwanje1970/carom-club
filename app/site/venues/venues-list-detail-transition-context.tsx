"use client";

import { createContext, useContext } from "react";

export type VenuesListDetailTransitionContextValue = {
  signalForwardIntent: () => void;
  signalBackIntent: () => void;
  beginForwardOpening: (targetHref: string) => void;
};

export const VenuesListDetailTransitionContext = createContext<VenuesListDetailTransitionContextValue | null>(null);

export function useVenuesListDetailTransition(): VenuesListDetailTransitionContextValue | null {
  return useContext(VenuesListDetailTransitionContext);
}
