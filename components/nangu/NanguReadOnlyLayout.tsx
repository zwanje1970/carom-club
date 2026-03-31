"use client";

import React, { type ReactNode, type RefObject } from "react";
import { BilliardTableCanvas, type TableDrawStyle } from "@/components/billiard";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { BallColor } from "@/lib/billiard-table-constants";

/** 원본 공배치 읽기 전용 표시. 드래그/클릭 불가, 수구 구분 표시 */
export function NanguReadOnlyLayout({
  ballPlacement,
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
  showGrid = true,
  className,
  fillContainer = false,
  embedFill = false,
  hideObjectBall = false,
  ballNormOverrides,
  showCueBallSpot = true,
  showObjectBallSpot = false,
  objectBallSpotKey = null,
  showSecondObjectBallSpot = false,
  secondObjectBallSpotKey = null,
  cueBallSpotRingBlackStroke = false,
  objectBallSpotRingBlackStroke = false,
  secondObjectBallSpotRingBlackStroke = false,
  drawStyle = "realistic",
  orientation = "landscape",
  betweenTableAndBallsLayer,
  pathOverlayAboveBalls = false,
  cueTipNorm = null,
  ballNormOverridesLiveRef,
  playbackBallAnimActive = false,
  hideOriginGhostBalls = false,
}: {
  ballPlacement: NanguBallPlacement;
  width?: number;
  height?: number;
  showGrid?: boolean;
  className?: string;
  /** true면 부모 폭/높이를 채움 (배치도 확대용) */
  fillContainer?: boolean;
  /** 줌 월드 고정 크기(W×H) 안에서 캔버스만 100% 채움 — BilliardTableCanvas.embedFill */
  embedFill?: boolean;
  /** `BilliardTableCanvas.hideRedBall`로 전달 — 색 키 red 스프라이트만 숨김. 1목적구=red가 아님 */
  hideObjectBall?: boolean;
  /** 경로 재생 시 공 위치 덮어쓰기 */
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  /** 재생 중 rAF 충돌 방지용으로 끄기 */
  showCueBallSpot?: boolean;
  /** 첫 목적구(reflection) 경로 편집 모드: `objectBallSpotKey` 해당 공 점선 스팟 깜빡임 */
  showObjectBallSpot?: boolean;
  objectBallSpotKey?: BallColor | null;
  /** 2목 경로 그리기 모드 */
  showSecondObjectBallSpot?: boolean;
  secondObjectBallSpotKey?: BallColor | null;
  /** 활성 경로 스팟이 공/쿠션에 닿으면 점선 링 검정 */
  cueBallSpotRingBlackStroke?: boolean;
  objectBallSpotRingBlackStroke?: boolean;
  secondObjectBallSpotRingBlackStroke?: boolean;
  /** 실사 | 단순보기(와이어프레임) */
  drawStyle?: TableDrawStyle;
  /** 난구노트 전체화면과 동일하게 기기 방향 반영 */
  orientation?: TableOrientation;
  /** 테이블·공 사이 레이어(경로 SVG) — 지정 시 공이 경로선 위에 그려짐 */
  betweenTableAndBallsLayer?: ReactNode;
  /** 기본 false. true면 경로 SVG를 공 위(z-30)로 — 난구 해법은 공 최상위 유지를 위해 보통 사용 안 함 */
  pathOverlayAboveBalls?: boolean;
  /** 해법 패널 당점 — 수구 위 점 표시만 */
  cueTipNorm?: { x: number; y: number } | null;
  ballNormOverridesLiveRef?: RefObject<
    Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>> | null | undefined
  >;
  playbackBallAnimActive?: boolean;
  /** 재생 중 배치 원점 ghost 미표시(시각만) */
  hideOriginGhostBalls?: boolean;
}) {
  return (
    <div
      className={className ?? "rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600"}
      style={fillContainer ? { width: "100%", height: "100%" } : { maxWidth: width }}
    >
      <BilliardTableCanvas
        width={width}
        height={height}
        redBall={ballPlacement.redBall}
        yellowBall={ballPlacement.yellowBall}
        whiteBall={ballPlacement.whiteBall}
        cueBall={ballPlacement.cueBall}
        interactive={false}
        showGrid={showGrid}
        showCueBallSpot={showCueBallSpot}
        showObjectBallSpot={showObjectBallSpot}
        objectBallSpotKey={objectBallSpotKey}
        showSecondObjectBallSpot={showSecondObjectBallSpot}
        secondObjectBallSpotKey={secondObjectBallSpotKey}
        cueBallSpotRingBlackStroke={cueBallSpotRingBlackStroke}
        objectBallSpotRingBlackStroke={objectBallSpotRingBlackStroke}
        secondObjectBallSpotRingBlackStroke={secondObjectBallSpotRingBlackStroke}
        hideRedBall={hideObjectBall}
        ballNormOverrides={ballNormOverrides}
        cueTipNorm={cueTipNorm}
        drawStyle={drawStyle}
        embedFill={embedFill}
        orientation={orientation}
        splitBallLayer={Boolean(betweenTableAndBallsLayer)}
        pathOverlayAboveBalls={pathOverlayAboveBalls}
        ballNormOverridesLiveRef={ballNormOverridesLiveRef}
        playbackBallAnimActive={playbackBallAnimActive}
        hideOriginGhostBalls={hideOriginGhostBalls}
      >
        {betweenTableAndBallsLayer}
      </BilliardTableCanvas>
    </div>
  );
}
