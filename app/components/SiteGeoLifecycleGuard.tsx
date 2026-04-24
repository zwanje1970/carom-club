"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { clearStoredVenueCoords } from "../site/lib/site-geolocation-flow";

/** 루트 `/` 및 `/site/*` 를 공개 사이트로 본다. */
function isPublicSitePath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return pathname.startsWith("/site");
}

/**
 * 공개 사이트를 벗어나면 저장된 위치 좌표(sessionStorage)를 버린다.
 * 같은 방문 안에서는 `/` ↔ `/site/*` 이동만으로는 지우지 않는다.
 */
export default function SiteGeoLifecycleGuard() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev === null) return;
    if (isPublicSitePath(prev) && !isPublicSitePath(pathname)) {
      clearStoredVenueCoords();
    }
  }, [pathname]);

  useEffect(() => {
    const onPageHide = () => {
      try {
        const p = window.location.pathname;
        if (isPublicSitePath(p)) clearStoredVenueCoords();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return null;
}
