"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useVenuesListDetailTransition } from "./venues-list-detail-transition-context";

type Props = {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export default function VenuesListBackLink({ href, className, style, children }: Props) {
  const ctx = useVenuesListDetailTransition();
  return (
    <Link prefetch href={href} className={className} style={style} onClick={() => ctx?.signalBackIntent()}>
      {children}
    </Link>
  );
}
