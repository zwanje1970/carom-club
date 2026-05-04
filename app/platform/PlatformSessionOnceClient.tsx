"use client";

import { useEffect } from "react";

let platformSessionProbeSent = false;

/** 플랫폼 구간 최초 1회만 `GET /api/auth/session` (StrictMode 이중 마운트 대비 모듈 스코프 가드). */
export default function PlatformSessionOnceClient() {
  useEffect(() => {
    if (platformSessionProbeSent) return;
    platformSessionProbeSent = true;
    void fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
  }, []);
  return null;
}
