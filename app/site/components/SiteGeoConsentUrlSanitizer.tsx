"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GEO_PARAM_KEYS = ["distanceLat", "distanceLng", "distanceDenied"] as const;

function isGeoListPath(pathname: string): boolean {
  return pathname === "/site/venues" || pathname === "/site/tournaments";
}

/** 북마크·이전 링크에 남은 거리 쿼리를 제거(좌표는 URL에 두지 않음) */
export default function SiteGeoConsentUrlSanitizer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGeoListPath(pathname)) return;
    const next = new URLSearchParams(searchParams.toString());
    let changed = false;
    for (const k of GEO_PARAM_KEYS) {
      if (next.has(k)) {
        next.delete(k);
        changed = true;
      }
    }
    if (pathname === "/site/tournaments" && next.get("sort") === "DISTANCE") {
      next.delete("sort");
      changed = true;
    }
    if (!changed) return;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
