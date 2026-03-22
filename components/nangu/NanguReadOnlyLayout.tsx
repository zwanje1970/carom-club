"use client";

import React, { type ReactNode } from "react";
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
  drawStyle = "realistic",
  orientation = "landscape",
  betweenTableAndBallsLayer,
  pathOverlayAboveBalls = false,
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
  /** 1목적구(red) 숨김 — 1목 경로 미입력 시 애니메이션 시연 등 */
  hideObjectBall?: boolean;
  /** 경로 재생 시 공 위치 덮어쓰기 */
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  /** 재생 중 rAF 충돌 방지용으로 끄기 */
  showCueBallSpot?: boolean;
  /** 1목 경로 그리기 모드: 목적구 점선 스팟 깜빡임 */
  showObjectBallSpot?: boolean;
  objectBallSpotKey?: BallColor | null;
  /** 실사 | 단순보기(와이어프레임) */
  drawStyle?: TableDrawStyle;
  /** 당구노트 전체화면과 동일하게 기기 방향 반영 */
  orientation?: TableOrientation;
  /** 테이블·공 사이 레이어(경로 SVG) — 지정 시 공이 경로선 위에 그려짐 */
  betweenTableAndBallsLayer?: ReactNode;
  /** 기본 false. true면 경로 SVG를 공 위(z-30)로 — 난구 해법은 공 최상위 유지를 위해 보통 사용 안 함 */
  pathOverlayAboveBalls?: boolean;
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
        hideRedBall={hideObjectBall}
        ballNormOverrides={ballNormOverrides}
        drawStyle={drawStyle}
        embedFill={embedFill}
        orientation={orientation}
        splitBallLayer={Boolean(betweenTableAndBallsLayer)}
        pathOverlayAboveBalls={pathOverlayAboveBalls}
      >
        {betweenTableAndBallsLayer}
      </BilliardTableCanvas>
    </div>
  );
}
