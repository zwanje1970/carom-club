"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCommunityListDetailTransition } from "../community/community-list-detail-transition-context";
import { useTournamentsListDetailTransition } from "../tournaments/tournaments-list-detail-transition-context";
import { useVenuesListDetailTransition } from "../venues/venues-list-detail-transition-context";

export type SiteHeaderListBackTransition = "tournaments" | "venues" | "community" | "mypage";

/**
 * 상단 청 헤더용 목록 링크 — `Link` + 기본 prefetch로 목록 RSC를 미리 받아 두어 복귀 체감 지연을 줄임.
 * 목록/상세 전환 셸이 있으면 `onClick`에서 `signalBackIntent`(짧은 nudge) 호출.
 */
export default function SiteHeaderListBackLink({
  href,
  transition,
  children = "← 목록",
}: {
  href: string;
  transition: SiteHeaderListBackTransition;
  children?: ReactNode;
}) {
  const tourn = useTournamentsListDetailTransition();
  const venue = useVenuesListDetailTransition();
  const comm = useCommunityListDetailTransition();

  const onClick = () => {
    if (transition === "tournaments") tourn?.signalBackIntent();
    else if (transition === "venues") venue?.signalBackIntent();
    else if (transition === "community") comm?.signalBackIntent();
  };

  return (
    <Link prefetch href={href} className="site-shell-header-list-back" onClick={onClick}>
      {children}
    </Link>
  );
}
