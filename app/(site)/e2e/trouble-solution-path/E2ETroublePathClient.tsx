"use client";

/**
 * E2E 전용 — 난구 경로 편집기만 풀스크린으로 띄움.
 * fixture 쿼리로 초기 pathPoints / objectPathPoints 제어 (리마운트로 잔상 없음).
 */
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SolutionPathEditorFullscreen } from "@/components/nangu/SolutionPathEditorFullscreen";
import {
  E2E_TROUBLE_BALL_PLACEMENT,
  getTroublePathFixture,
} from "../../../../e2e/fixtures/trouble-path-fixtures";
import type { BallSpeed } from "@/lib/ball-speed-constants";

function E2ETroublePathInner() {
  const searchParams = useSearchParams();
  const fixture = searchParams.get("fixture") ?? "interactive";
  const { pathPoints, objectPathPoints } = getTroublePathFixture(fixture);

  const ballSpeed = 3.0 as BallSpeed;

  return (
    <SolutionPathEditorFullscreen
      key={fixture}
      variant="trouble"
      presentation="noteBallPlacementFullscreen"
      readOnlyCueAndBalls
      ballPlacement={E2E_TROUBLE_BALL_PLACEMENT}
      layoutImageUrl={null}
      initialPathPoints={pathPoints}
      initialObjectPathPoints={objectPathPoints}
      thicknessOffsetX={0.5}
      isBankShot={false}
      ballSpeed={ballSpeed}
      onCancel={() => {
        /* E2E: 닫기 없음 */
      }}
      onConfirm={() => {
        /* E2E */
      }}
    />
  );
}

export function E2ETroublePathClient() {
  return (
    <Suspense fallback={<p className="p-4 text-site-text">E2E 로딩…</p>}>
      <E2ETroublePathInner />
    </Suspense>
  );
}
