import { normalizeBallSpeed } from "@/lib/ball-speed-constants";

export function clampRailCount(n: number): number {
  return Math.max(1, Math.min(5, Math.round(Number(n) || 3)));
}

export function deriveBallSpeedFromRailCount(railCount: number) {
  return normalizeBallSpeed(clampRailCount(railCount));
}
