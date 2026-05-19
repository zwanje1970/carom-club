"use client";

import { useLayoutEffect, useRef } from "react";
import { logCommunityListLoadDiagPhase } from "../../../lib/site/community-load-diag";

type Props = {
  itemCount: number;
};

/**
 * 목록 첫 페인트·목록 영역 로더 제거 시점 — CommunityBoardPostList 하위 전용.
 */
export default function CommunityLoadDiagListMarkers({ itemCount }: Props) {
  const firstListLoggedRef = useRef(false);
  const loaderHiddenLoggedRef = useRef(false);

  useLayoutEffect(() => {
    if (firstListLoggedRef.current) return;
    firstListLoggedRef.current = true;
    logCommunityListLoadDiagPhase("first-list-rendered", { itemCount });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (loaderHiddenLoggedRef.current) return;
        loaderHiddenLoggedRef.current = true;
        const listLoaderPresent = Boolean(document.querySelector("[data-community-list-loading]"));
        const hubLoaderPresent = Boolean(document.querySelector(".site-hub-route-loading-section"));
        logCommunityListLoadDiagPhase("list-loader-hidden", {
          itemCount,
          listLoaderStillInDom: listLoaderPresent,
          hubLoaderStillInDom: hubLoaderPresent,
        });
      });
    });
  }, [itemCount]);

  return null;
}
