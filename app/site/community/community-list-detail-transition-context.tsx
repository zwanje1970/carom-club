"use client";

import { createContext, useContext } from "react";

export type CommunityListDetailTransitionContextValue = {
  signalForwardIntent: () => void;
  signalBackIntent: () => void;
};

export const CommunityListDetailTransitionContext = createContext<CommunityListDetailTransitionContextValue | null>(
  null,
);

export function useCommunityListDetailTransition(): CommunityListDetailTransitionContextValue | null {
  return useContext(CommunityListDetailTransitionContext);
}
