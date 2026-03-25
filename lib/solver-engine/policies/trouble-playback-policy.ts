/** Policy: railCount(1~5) -> playback speed multiplier */
export function troublePlaybackSpeedFactorFromRailCount(railCount: number): number {
  const r = Math.max(1, Math.min(5, Math.round(Number(railCount) || 3)));
  const table: Record<number, number> = {
    1: 1.0,
    2: 1.25,
    3: 1.5,
    4: 1.75,
    5: 2.0,
  };
  return table[r] ?? 1.0;
}

/** Legacy policy kept for compatibility consumers */
export function timePerRailSecFromRailSpeed(railSpeed: number): number {
  const r = Math.max(1, Math.min(5, Math.round(Number(railSpeed) || 3)));
  return 1.15 - 0.15 * r;
}

/** Legacy policy kept for compatibility consumers */
export function clampTroubleRailSpeed(railSpeed: number | undefined | null): number {
  return Math.max(1, Math.min(5, Math.round(Number(railSpeed) || 3)));
}
