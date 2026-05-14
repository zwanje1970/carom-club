"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useTournamentsListDetailTransition } from "./tournaments-list-detail-transition-context";

type Props = {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** 대회 상세 → 목록 복귀 시 탭 즉시 반응(전환 셸 nudge) — `/site/tournaments` 전용 컨텍스트 */
export default function TournamentsListBackLink({ href, className, style, children }: Props) {
  const ctx = useTournamentsListDetailTransition();
  return (
    <Link prefetch href={href} className={className} style={style} onClick={() => ctx?.signalBackIntent()}>
      {children}
    </Link>
  );
}
