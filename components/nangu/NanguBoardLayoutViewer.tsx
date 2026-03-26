"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BallPos {
  x: number;
  y: number;
}

interface NanguBoardLayoutViewerProps {
  cueBall: BallPos;
  objectBall1: BallPos;
  objectBall2: BallPos;
  isMini?: boolean;
  className?: string;
}

/**
 * NanguBoardLayoutViewer: 2:1 비율의 당구대 레이아웃 뷰어
 * 수구(White), 제1목적구(Yellow), 제2목적구(Red)를 배치합니다.
 */
export function NanguBoardLayoutViewer({
  cueBall,
  objectBall1,
  objectBall2,
  isMini = false,
  className,
}: NanguBoardLayoutViewerProps) {
  // 미니 모드에 따른 공 크기 설정 (w-3 vs w-6)
  const ballSizeClass = isMini ? "w-3 h-3" : "w-6 h-6";

  const renderBall = (pos: BallPos, colorClass: string, zIndex: string) => (
    <div
      className={cn(
        "absolute rounded-full shadow-md",
        ballSizeClass,
        colorClass,
        zIndex
      )}
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)", // 좌표 중심 정렬
      }}
    />
  );

  return (
    <div
      className={cn(
        "relative w-full aspect-[2/1] bg-green-800 rounded-lg overflow-hidden border-4 border-amber-900 shadow-inner",
        className
      )}
    >
      {/* 당구대 내부 가이드 라인 (선택 사항) */}
      <div className="absolute inset-0 border-[4px] border-black/10 pointer-events-none" />

      {/* 수구 (White) */}
      {renderBall(cueBall, "bg-white", "z-30")}
      
      {/* 제1목적구 (Yellow) */}
      {renderBall(objectBall1, "bg-yellow-400", "z-20")}
      
      {/* 제2목적구 (Red) */}
      {renderBall(objectBall2, "bg-red-600", "z-10")}
    </div>
  );
}
