"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { performGeolocationThenNavigate } from "../lib/site-geolocation-flow";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & { href: string };

/**
 * 당구장 목록으로 가는 링크 — 클릭 시 위치 좌표를 붙여 이동(사용자 제스처에서만 geolocation).
 */
export default function VenuesDistanceNavLink({ href, ...rest }: Props) {
  const router = useRouter();
  return (
    <Link
      {...rest}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        performGeolocationThenNavigate(href, (path) => router.push(path));
      }}
    />
  );
}
