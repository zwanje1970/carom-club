"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function detectClientMobileShellRuntime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const bridge = (window as Window & { CaromAppBridge?: unknown }).CaromAppBridge;
    if (bridge != null && typeof bridge === "object") return true;
  } catch {
    /* ignore */
  }
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (ua.includes("; wv)") || ua.includes("; wv ")) return true;
  if (ua.includes("caromclubapp") || ua.includes("carom-club-app")) return true;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    if ("standalone" in nav && nav.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 소프트 네비게이션 시 `html[data-mobile-app-shell]` 동기화 — /client 이탈 시 제거, 앱 런타임이면 유지·보강.
 */
export default function CaromClientMobileShellHtmlSync() {
  const pathname = usePathname() ?? "";
  useEffect(() => {
    const el = document.documentElement;
    if (!pathname.startsWith("/client")) {
      el.removeAttribute("data-mobile-app-shell");
      return;
    }
    if (detectClientMobileShellRuntime()) {
      el.setAttribute("data-mobile-app-shell", "1");
    } else {
      el.removeAttribute("data-mobile-app-shell");
    }
  }, [pathname]);
  return null;
}
