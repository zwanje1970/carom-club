"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useCommunityListDetailTransition } from "./community-list-detail-transition-context";

function shouldPrimaryListNavigate(ev: React.MouseEvent): boolean {
  if (ev.defaultPrevented) return false;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
  if (ev.button !== 0) return false;
  return true;
}

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
};

/** 목록 행 → 게시글 상세: 탭 직시 nudge용(탭·검색 전용 링크에는 사용하지 않음) */
export default function CommunityPostDetailRowLink({ href, className, children, prefetch = false }: Props) {
  const router = useRouter();
  const ctx = useCommunityListDetailTransition();
  return (
    <Link
      prefetch={prefetch}
      href={href}
      className={className}
      onClick={(ev) => {
        if (!shouldPrimaryListNavigate(ev)) return;
        ev.preventDefault();
        flushSync(() => {
          ctx?.beginForwardOpening(href);
        });
        router.push(href);
      }}
    >
      {children}
    </Link>
  );
}
