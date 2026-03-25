/**
 * Facade for compatibility.
 * Core math and policy are extracted under `lib/solver-engine/*`.
 */
export {
  timeMsForDistanceAlongEqualEdgeTimes,
  distancePxAfterTimeMsAlongEqualEdgeTimes,
  buildSegmentTimesMsProportionalToLength,
  timeMsForDistanceAlongVariableEdgeTimes,
  distancePxAfterTimeMsAlongVariableEdgeTimes,
} from "@/lib/solver-engine/core/equal-edge-timing";
export {
  troublePlaybackSpeedFactorFromRailCount,
  timePerRailSecFromRailSpeed,
  clampTroubleRailSpeed,
} from "@/lib/solver-engine/policies/trouble-playback-policy";
