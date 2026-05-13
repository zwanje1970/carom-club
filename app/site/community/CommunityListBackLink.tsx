"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCommunityListDetailTransition } from "./community-list-detail-transition-context";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** 게시글 상세 → 목록 복귀 시 탭 직시 nudge */
export default function CommunityListBackLink({ href, className, children }: Props) {
  const ctx = useCommunityListDetailTransition();
  return (
    <Link prefetch={false} href={href} className={className} onClick={() => ctx?.signalBackIntent()}>
      {children}
    </Link>
  );
}
