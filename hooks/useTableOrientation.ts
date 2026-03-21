"use client";

import { useState, useEffect } from "react";
import type { TableOrientation } from "@/lib/billiard-table-constants";

/** 당구노트 공배치 전체화면 등 — 뷰포트 가로/세로형 */
export function useTableOrientation(): TableOrientation {
  const [orientation, setOrientation] = useState<TableOrientation>("landscape");
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setOrientation(mq.matches ? "portrait" : "landscape");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return orientation;
}
