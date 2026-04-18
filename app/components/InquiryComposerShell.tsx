"use client";

import type { ReactNode } from "react";

type Props = {
  scroll: ReactNode;
  composer: ReactNode;
};

/**
 * 문의 상세(플랫폼/클라이언트) 공통: 스크롤 영역 + 하단 입력(문서 흐름, 뷰포트 하단 고정)
 */
export default function InquiryComposerShell({ scroll, composer }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        maxHeight: "100dvh",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {scroll}
      </div>
      <div
        style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 71,
          borderTop: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 -4px 12px rgba(15,23,42,0.06)",
          paddingTop: "0.65rem",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {composer}
      </div>
    </div>
  );
}
