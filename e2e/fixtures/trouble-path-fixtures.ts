/**
 * 난구 경로 E2E — `SolutionPathEditorFullscreen` 초기값용 (실제 좌표계와 동일한 landscape norm)
 */
import type { NanguBallPlacement, NanguPathPoint } from "../../lib/nangu-types";

/** E2E 페이지와 Playwright가 공유하는 고정 배치 (수구 흰공) */
export const E2E_TROUBLE_BALL_PLACEMENT: NanguBallPlacement = {
  cueBall: "white",
  redBall: { x: 0.35, y: 0.5 },
  yellowBall: { x: 0.65, y: 0.5 },
  whiteBall: { x: 0.12, y: 0.38 },
};

function spot(id: string, x: number, y: number, type: NanguPathPoint["type"]): NanguPathPoint {
  return { id, x, y, type };
}

export type TroublePathFixtureName =
  | "interactive"
  | "firstRed"
  | "cushionsOnly"
  | "firstYellow"
  | "cushionsThenRed"
  | "objectPathOneSegment"
  | "cueAndObjectPaths"
  | "objectPathBallOnly";

export function getTroublePathFixture(name: string | null): {
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
} {
  const key = (name ?? "interactive") as TroublePathFixtureName;
  switch (key) {
    case "firstRed":
      return {
        pathPoints: [spot("e2e-red", E2E_TROUBLE_BALL_PLACEMENT.redBall.x, E2E_TROUBLE_BALL_PLACEMENT.redBall.y, "ball")],
        objectPathPoints: [],
      };
    case "cushionsOnly":
      return {
        pathPoints: [
          spot("c1", 0.25, 0.4, "cushion"),
          spot("c2", 0.28, 0.42, "cushion"),
        ],
        objectPathPoints: [],
      };
    case "firstYellow":
      return {
        pathPoints: [
          spot("e2e-y", E2E_TROUBLE_BALL_PLACEMENT.yellowBall.x, E2E_TROUBLE_BALL_PLACEMENT.yellowBall.y, "ball"),
        ],
        objectPathPoints: [],
      };
    case "cushionsThenRed":
      return {
        pathPoints: [
          spot("c1", 0.25, 0.4, "cushion"),
          spot("c2", 0.28, 0.42, "cushion"),
          spot("c3", 0.32, 0.46, "cushion"),
          spot("e2e-red", E2E_TROUBLE_BALL_PLACEMENT.redBall.x, E2E_TROUBLE_BALL_PLACEMENT.redBall.y, "ball"),
        ],
        objectPathPoints: [],
      };
    /** 수구 경로에 빨간 공 스팟 + 1목 경로에 쿠션 1개 → object 세그먼트 1개 이상 */
    case "objectPathOneSegment": {
      const col = { x: 0.33, y: 0.49 };
      return {
        pathPoints: [spot("e2e-red", E2E_TROUBLE_BALL_PLACEMENT.redBall.x, E2E_TROUBLE_BALL_PLACEMENT.redBall.y, "ball")],
        objectPathPoints: [spot("o1", col.x, col.y, "cushion")],
      };
    }
    /** 수구·1목 경로 모두 선분 존재 */
    case "cueAndObjectPaths":
      return {
        pathPoints: [
          spot("c1", 0.22, 0.36, "cushion"),
          spot("e2e-red", E2E_TROUBLE_BALL_PLACEMENT.redBall.x, E2E_TROUBLE_BALL_PLACEMENT.redBall.y, "ball"),
        ],
        objectPathPoints: [
          spot("o1", 0.48, 0.52, "cushion"),
          spot("o2", 0.55, 0.48, "cushion"),
        ],
      };
    /** 수구 경로에 공 스팟 없음 — 1목은 1목 경로의 ball 스팟만으로 확정(재생 reflection도 동일 기준) */
    case "objectPathBallOnly":
      return {
        pathPoints: [spot("c1", 0.22, 0.36, "cushion")],
        objectPathPoints: [
          spot("onRed", E2E_TROUBLE_BALL_PLACEMENT.redBall.x, E2E_TROUBLE_BALL_PLACEMENT.redBall.y, "ball"),
          spot("o2", 0.55, 0.48, "cushion"),
        ],
      };
    case "interactive":
    default:
      return { pathPoints: [], objectPathPoints: [] };
  }
}
