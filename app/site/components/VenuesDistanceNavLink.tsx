"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/**
 * 당구장 목록으로 가는 링크 — 메인 등에서는 위치 요청 없이 이동만 함.
 */
export default function VenuesDistanceNavLink({ href, ...rest }: Props) {
  return <Link {...rest} href={href} />;
}
