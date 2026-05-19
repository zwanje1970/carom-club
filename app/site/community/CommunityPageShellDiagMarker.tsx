"use client";

import { useLayoutEffect } from "react";
import { logCommunityListLoadDiagPhase } from "../../../lib/site/community-load-diag";

/** 서버가 껍데기 HTML을 내려준 직후 — 클라이언트 첫 페인트 직전 */
export default function CommunityPageShellDiagMarker() {
  useLayoutEffect(() => {
    logCommunityListLoadDiagPhase("page-shell-rendered");
  }, []);
  return null;
}
