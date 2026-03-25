export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** cue easing: preserve existing playback feel */
export function easeOutCue(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 1.35);
}

/** object easing: faster decay than cue */
export function easeOutObject(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 2.2);
}
