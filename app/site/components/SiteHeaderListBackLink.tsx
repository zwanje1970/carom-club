"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCommunityListDetailTransition } from "../community/community-list-detail-transition-context";
import { useTournamentsListDetailTransition } from "../tournaments/tournaments-list-detail-transition-context";
import { useVenuesListDetailTransition } from "../venues/venues-list-detail-transition-context";

export type SiteHeaderListBackTransition = "tournaments" | "venues" | "community";

/**
 * 상단 청 헤더용 목록 링크 — 항목 URL로 이동하며, 목록/상세 전환 셸이 있으면 `signalBackIntent`로 스크롤 복원 힌트.
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
    else comm?.signalBackIntent();
  };

  return (
    <Link prefetch={false} href={href} className="site-shell-header-list-back" onClick={onClick}>
      {children}
    </Link>
  );
}
