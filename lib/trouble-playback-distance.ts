/**
 * Facade for compatibility.
 * Distance policy is extracted under `lib/solver-engine/policies`.
 */
export {
  TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR,
  getTroublePlayableDistanceFromRailCount,
  troubleTotalMovableDistancePx,
  getCuePlayableDistanceFromBallSpeed,
} from "@/lib/solver-engine/policies/trouble-distance-policy";
