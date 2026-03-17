"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type BallPlacementFullscreenContextValue = {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
};

const BallPlacementFullscreenContext =
  createContext<BallPlacementFullscreenContextValue | null>(null);

export function BallPlacementFullscreenProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isFullscreen, setFullscreen] = useState(false);
  return (
    <BallPlacementFullscreenContext.Provider
      value={{ isFullscreen, setFullscreen }}
    >
      {children}
    </BallPlacementFullscreenContext.Provider>
  );
}

export function useBallPlacementFullscreen() {
  const ctx = useContext(BallPlacementFullscreenContext);
  return ctx;
}
