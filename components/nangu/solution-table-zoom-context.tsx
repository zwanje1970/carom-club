"use client";

import { createContext, useContext } from "react";

export interface SolutionTableZoomContextValue {
  /** 브라우저 client 좌표 → 캔버스(테이블) 픽셀 (0..contentW/H) */
  viewportClientToCanvasPx: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** 월드(테이블)에 적용된 최종 CSS scale (맞춤×줌). 미세조정 UI 등 역스케일용 */
  contentVisualScale: number;
}

const SolutionTableZoomContext = createContext<SolutionTableZoomContextValue | null>(null);

export function SolutionTableZoomProvider({
  value,
  children,
}: {
  value: SolutionTableZoomContextValue;
  children: React.ReactNode;
}) {
  return <SolutionTableZoomContext.Provider value={value}>{children}</SolutionTableZoomContext.Provider>;
}

export function useSolutionTableZoomContext(): SolutionTableZoomContextValue | null {
  return useContext(SolutionTableZoomContext);
}
