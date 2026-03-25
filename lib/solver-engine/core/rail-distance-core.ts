/**
 * Core distance math:
 * - Computes travel distance from long-rail unit and rail step.
 */
export function playableDistanceFromLongRail(
  longRailDistance: number,
  railCount: number,
  extraFactor: number
): number {
  const rail = Math.max(1, Math.min(5, Math.round(Number(railCount) || 3)));
  return longRailDistance * rail * extraFactor;
}
