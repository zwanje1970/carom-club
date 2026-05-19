"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isCommunityBoardListHubPath } from "../lib/site-root-swipe-order";
import {
  logCommunityListLoadDiagPhase,
  resetCommunityListLoadDiagRouteEnter,
} from "../../../lib/site/community-load-diag";

/**
 * 커뮤니티 목록 허브 진입 진단 — `/site/community` layout 전용(메인 번들 분리).
 */
export default function CommunityListLoadDiagTracker() {
  const pathname = usePathname() ?? "";
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isCommunityBoardListHubPath(pathname)) {
      prevPathRef.current = pathname;
      return;
    }
    const prev = prevPathRef.current;
    if (prev !== pathname) {
      resetCommunityListLoadDiagRouteEnter();
      logCommunityListLoadDiagPhase("route-enter", { pathname });
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
