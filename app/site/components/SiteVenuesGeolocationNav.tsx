"use client";

import { useEffect } from "react";
import {
  eventTargetElement,
  performGeolocationThenNavigate,
} from "../lib/site-geolocation-flow";

/** @deprecated import from `../lib/site-geolocation-flow` — 호환용 재export */
export { VENUES_GEO_STORAGE_LAT, VENUES_GEO_STORAGE_LNG } from "../lib/site-geolocation-flow";

/**
 * 보조: `a[data-distance-trigger='true']` + `/site/venues` | `/site/tournaments` 링크 클릭 시
 * `performGeolocationThenNavigate`와 동일 동작. 메인 보장은 각 화면/컴포넌트 클릭 핸들러.
 */
export default function SiteVenuesGeolocationNav() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = eventTargetElement(event);
      if (!el) return;
      const trigger = el.closest("a[data-distance-trigger='true']");
      if (!(trigger instanceof HTMLAnchorElement)) return;

      let path: string;
      try {
        path = new URL(trigger.href, window.location.origin).pathname;
      } catch {
        return;
      }
      const isVenues = path.startsWith("/site/venues");
      const isTournaments = path.startsWith("/site/tournaments");
      if (!isVenues && !isTournaments) return;

      event.preventDefault();

      if (isVenues) {
        const latKey = trigger.dataset.latKey ?? "";
        const lngKey = trigger.dataset.lngKey ?? "";
        const deniedKey = trigger.dataset.deniedKey ?? "";
        if (!latKey || !lngKey || !deniedKey) {
          window.location.assign(trigger.href);
          return;
        }
      }

      performGeolocationThenNavigate(trigger.href, (h) => window.location.assign(h));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
