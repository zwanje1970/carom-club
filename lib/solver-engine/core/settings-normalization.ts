export function clampIntegerInRange(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function clampUnitCircle(tip: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(tip.x, tip.y);
  if (len > 1 && len > 1e-9) {
    return { x: tip.x / len, y: tip.y / len };
  }
  return { x: tip.x, y: tip.y };
}
