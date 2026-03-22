/**
 * 난구 1목적구 판정 — 실제 동작 검증(스팟 순서·해제·쿠션 경유).
 * UI E2E 대신 파순 함수 `resolveTroubleFirstObjectBallKey`로 시나리오 1~6을 재현.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, NanguPathPoint } from "@/lib/nangu-types";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";

const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);

/** 수구 흰공 — 비수구는 빨·노만 사용 */
const placementWhiteCue: NanguBallPlacement = {
  cueBall: "white",
  redBall: { x: 0.35, y: 0.5 },
  yellowBall: { x: 0.65, y: 0.5 },
  whiteBall: { x: 0.2, y: 0.35 },
};

const cuePos = { x: placementWhiteCue.whiteBall.x, y: placementWhiteCue.whiteBall.y };

function spot(id: string, x: number, y: number, type: NanguPathPoint["type"]): NanguPathPoint {
  return { id, x, y, type };
}

function resolve(
  pathPoints: NanguPathPoint[],
  objectPathPoints: NanguPathPoint[],
  p: NanguBallPlacement = placementWhiteCue
) {
  return resolveTroubleFirstObjectBallKey({
    placement: p,
    cuePos,
    pathPoints,
    objectPathPoints,
    rect,
  });
}

describe("resolveTroubleFirstObjectBallKey — 난구 시나리오", () => {
  it("1) 수구 경로에서 빨간 공에 먼저 공 스팟이 있으면 1목은 red", () => {
    const pathPoints: NanguPathPoint[] = [
      spot("c1", 0.3, 0.45, "cushion"),
      spot("b-red", placementWhiteCue.redBall.x, placementWhiteCue.redBall.y, "ball"),
    ];
    expect(resolve(pathPoints, [])).toBe("red");
  });

  it("2) 수구 경로에서 유효한 공 스팟이 없어지면 1목은 null", () => {
    const onlyCushions: NanguPathPoint[] = [
      spot("c1", 0.3, 0.45, "cushion"),
      spot("c2", 0.4, 0.48, "cushion"),
    ];
    expect(resolve(onlyCushions, [])).toBeNull();
  });

  it("3) 이후 노란 공에 공 스팟이 있으면 1목은 yellow로 바뀜", () => {
    const pathPoints: NanguPathPoint[] = [
      spot("c1", 0.3, 0.45, "cushion"),
      spot("y", placementWhiteCue.yellowBall.x, placementWhiteCue.yellowBall.y, "ball"),
    ];
    expect(resolve(pathPoints, [])).toBe("yellow");
  });

  it("4) 쿠션 스팟 여러 개 뒤 첫 공 스팟이 1목", () => {
    const pathPoints: NanguPathPoint[] = [
      spot("c1", 0.25, 0.4, "cushion"),
      spot("c2", 0.28, 0.42, "cushion"),
      spot("c3", 0.32, 0.46, "cushion"),
      spot("br", placementWhiteCue.redBall.x, placementWhiteCue.redBall.y, "ball"),
    ];
    expect(resolve(pathPoints, [])).toBe("red");
  });

  it("5) 전체 비우기와 동일 — 배열이 비면 null (깜빡임 조건도 키 null로 꺼짐)", () => {
    expect(resolve([], [])).toBeNull();
  });

  it("6) 새 경로 — 이전 스냅샷이 없고 현재 배열만 반영 (이전 1목 잔상 없음)", () => {
    const before = resolve(
      [spot("b", placementWhiteCue.redBall.x, placementWhiteCue.redBall.y, "ball")],
      []
    );
    expect(before).toBe("red");
    const afterClear = resolve([], []);
    expect(afterClear).toBeNull();
    const afterNew = resolve(
      [spot("y", placementWhiteCue.yellowBall.x, placementWhiteCue.yellowBall.y, "ball")],
      []
    );
    expect(afterNew).toBe("yellow");
  });

  it("수구 경로에 공 스팟 없음 → 1목 경로에서 첫 공 스팟이 1목 (연속 구간 순서)", () => {
    const cueOnlyCushions: NanguPathPoint[] = [
      spot("c1", 0.25, 0.4, "cushion"),
      spot("c2", 0.3, 0.45, "cushion"),
    ];
    const objectLeg: NanguPathPoint[] = [
      spot("oy", placementWhiteCue.yellowBall.x, placementWhiteCue.yellowBall.y, "ball"),
    ];
    expect(resolve(cueOnlyCushions, objectLeg)).toBe("yellow");
  });

  it("수구 경로에 먼저 붙은 공 스팟이 있으면 1목 경로의 공 스팟보다 우선", () => {
    const cueWithRed: NanguPathPoint[] = [
      spot("br", placementWhiteCue.redBall.x, placementWhiteCue.redBall.y, "ball"),
      spot("c2", 0.4, 0.5, "cushion"),
    ];
    const objectLeg: NanguPathPoint[] = [
      spot("oy", placementWhiteCue.yellowBall.x, placementWhiteCue.yellowBall.y, "ball"),
    ];
    expect(resolve(cueWithRed, objectLeg)).toBe("red");
  });
});
