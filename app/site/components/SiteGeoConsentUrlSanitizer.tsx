"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { hasGeoConsentInSession } from "../lib/site-geolocation-flow";

const GEO_PARAM_KEYS = ["distanceLat", "distanceLng", "distanceDenied"] as const;

function isGeoListPath(pathname: string): boolean {
  return pathname === "/site/venues" || pathname === "/site/tournaments";
}

/** URL에만 좌표가 있고 세션 동의가 없으면(북마크·이전 탭 등) 거리 쿼리를 제거한다. */
export default function SiteGeoConsentUrlSanitizer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGeoListPath(pathname)) return;
    const hasCoordsInUrl = searchParams.has("distanceLat") || searchParams.has("distanceLng");
    if (!hasCoordsInUrl) return;
    if (hasGeoConsentInSession()) return;

    const next = new URLSearchParams(searchParams.toString());
    for (const k of GEO_PARAM_KEYS) {
      next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
