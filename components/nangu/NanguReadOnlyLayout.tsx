"use client";

import React from "react";
import { BilliardTableCanvas } from "@/components/billiard";
import { DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";

/** 원본 공배치 읽기 전용 표시. 드래그/클릭 불가, 수구 구분 표시 */
export function NanguReadOnlyLayout({
  ballPlacement,
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
  showGrid = true,
  className,
  fillContainer = false,
}: {
  ballPlacement: NanguBallPlacement;
  width?: number;
  height?: number;
  showGrid?: boolean;
  className?: string;
  /** true면 부모 폭/높이를 채움 (배치도 확대용) */
  fillContainer?: boolean;
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
        showCueBallSpot={true}
      />
    </div>
  );
}
