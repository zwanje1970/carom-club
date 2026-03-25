"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type GlobalChromeModeContextValue = {
  hideGlobalChrome: boolean;
  setGlobalChromeHidden: (value: boolean) => void;
};

const GlobalChromeModeContext =
  createContext<GlobalChromeModeContextValue | null>(null);

export function GlobalChromeModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hideGlobalChrome, setHideGlobalChrome] = useState(false);
  const setGlobalChromeHidden = useCallback((value: boolean) => {
    setHideGlobalChrome(value);
  }, []);

  return (
    <GlobalChromeModeContext.Provider
      value={{ hideGlobalChrome, setGlobalChromeHidden }}
    >
      {children}
    </GlobalChromeModeContext.Provider>
  );
}

export function useGlobalChromeMode() {
  return useContext(GlobalChromeModeContext);
}

/**
 * Backward-compatible adapter:
 * existing note/solver fullscreen callers still use this API.
 */
export function BallPlacementFullscreenProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GlobalChromeModeProvider>{children}</GlobalChromeModeProvider>;
}

export function useBallPlacementFullscreen() {
  const ctx = useGlobalChromeMode();
  if (!ctx) return null;
  return {
    isFullscreen: ctx.hideGlobalChrome,
    setFullscreen: ctx.setGlobalChromeHidden,
  };
}
