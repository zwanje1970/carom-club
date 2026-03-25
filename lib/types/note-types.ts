/**
 * 현재 `lib/nangu-types.ts`에서 노트 전용으로 확정 분리할 타입은 없음.
 * 다만 노트 화면에서 직접 소비하는 타입 경계를 위해 shared 타입 re-export를 둔다.
 */
export type {
  NanguBallPlacement,
  NanguCurveNode,
  NanguPathPoint,
  NanguSourceLayout,
} from "@/lib/types/shared-types";
