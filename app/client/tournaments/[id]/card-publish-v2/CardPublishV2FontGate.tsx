"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensureCardEditorFontsLoaded } from "./card-editor-fonts";

/**
 * 게시카드 편집기 레이아웃에서만 폰트 바이너리 로드(FontFace).
 * 자식은 항상 렌더(폰트 로드 전에는 시스템 폰트로 잠깐 보일 수 있음).
 */
export default function CardPublishV2FontGate({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void ensureCardEditorFontsLoaded().finally(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return children;
}
