"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LS_KEY = "carom-admin-dashboard-fab-pos.v2";
/** 목록·하단 탭과 겹침 완화 (~기존 72px 대비 축소) */
const FAB_SIZE = 50;
const DRAG_THRESHOLD_PX = 6;
const DEFAULT_RIGHT = 20;
/** 하단 고정 네비(~40px) + safe-area 여유 + 카드와 간격 */
const DEFAULT_BOTTOM = 124;
const Z_INDEX = 80;

type Pos = { left: number; top: number };

type SessionUser = {
  role: string;
  clientStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
};

function defaultPosition(): Pos {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    left: Math.max(8, w - FAB_SIZE - DEFAULT_RIGHT),
    top: Math.max(8, h - FAB_SIZE - DEFAULT_BOTTOM),
  };
}

function clampPosition(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxL = Math.max(8, w - FAB_SIZE - 8);
  const maxT = Math.max(8, h - FAB_SIZE - 8);
  return {
    left: Math.min(maxL, Math.max(8, p.left)),
    top: Math.min(maxT, Math.max(8, p.top)),
  };
}

function readStoredPosition(): Pos | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof j.left !== "number" || typeof j.top !== "number" || !Number.isFinite(j.left) || !Number.isFinite(j.top)) {
      return null;
    }
    return clampPosition({ left: j.left, top: j.top });
  } catch {
    return null;
  }
}

function isDashboardPath(pathname: string): boolean {
  const p = pathname || "";
  return p.startsWith("/client") || p.startsWith("/platform");
}

/** 공개 메인 — 관리자 FAB 비노출(다른 공개 경로·대시보드는 기존과 동일) */
function isPublicSiteMainHomePathname(path: string): boolean {
  const raw = path.split("?")[0] ?? "";
  const p = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return p === "/" || p === "/site";
}

function showFabForUser(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === "PLATFORM") return true;
  if (user.role === "CLIENT" && user.clientStatus === "APPROVED") return true;
  return false;
}

function targetHrefFromSite(user: SessionUser): string {
  if (user.role === "PLATFORM") return "/platform";
  return "/client";
}

/** RSC(`getAdminFloatingFabSessionUser`)에서만 채움 — 클라이언트에서 `/api/auth/session` 반복 호출 없음 */
export type AdminFabSessionUserProp = SessionUser | null;

export default function AdminDashboardFloatingFab({
  initialFabSessionUser,
}: {
  initialFabSessionUser: AdminFabSessionUserProp;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [user] = useState<SessionUser | null>(() => initialFabSessionUser);
  const [pos, setPos] = useState<Pos | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    dragged: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredPosition();
    setPos(stored ?? defaultPosition());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !pos) return;
    const onResize = () => setPos((p) => (p ? clampPosition(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  const persistPos = useCallback((p: Pos) => {
    const c = clampPosition(p);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ left: c.left, top: c.top }));
    } catch {
      /* ignore */
    }
    setPos(c);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pos) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: pos.left,
        origTop: pos.top,
        dragged: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) d.dragged = true;
    if (d.dragged) {
      setPos(clampPosition({ left: d.origLeft + dx, top: d.origTop + dy }));
    }
  }, []);

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const wasDragged = d.dragged || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (wasDragged) {
        persistPos(clampPosition({ left: d.origLeft + dx, top: d.origTop + dy }));
        return;
      }
      if (!user) return;
      const href = isDashboardPath(pathname) ? "/site" : targetHrefFromSite(user);
      router.push(href);
    },
    [pathname, persistPos, router, user],
  );

  if (!showFabForUser(user)) return null;
  if (isPublicSiteMainHomePathname(pathname)) return null;
  if (!pos) return null;

  const onDash = isDashboardPath(pathname);
  const titleHint = onDash ? "공개 사이트 메인으로" : "운영 대시보드로 이동";
  const iconSize = 22;
  const stroke = 1.85;

  return (
    <div
      role="button"
      tabIndex={0}
      title={titleHint}
      aria-label={titleHint}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          if (!user) return;
          router.push(isDashboardPath(pathname) ? "/site" : targetHrefFromSite(user));
        }
      }}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: 9999,
        zIndex: Z_INDEX,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: 0,
        background: "linear-gradient(165deg, #2f6fbf 0%, #2563eb 42%, #1e3a78 100%)",
        color: "#f8fafc",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        boxShadow: "0 1px 5px rgba(15, 23, 42, 0.16)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {onDash ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
          <path d="M9 22.5V12h6v10.5" />
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="7" height="9" rx="1.2" />
          <rect x="14" y="3" width="7" height="5" rx="1.2" />
          <rect x="14" y="11" width="7" height="10" rx="1.2" />
          <rect x="3" y="15" width="7" height="6" rx="1.2" />
        </svg>
      )}
    </div>
  );
}
