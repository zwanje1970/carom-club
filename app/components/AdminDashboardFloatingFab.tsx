"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LS_KEY = "carom-admin-dashboard-fab-pos.v1";
const FAB_SIZE = 72;
const DRAG_THRESHOLD_PX = 6;
const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 96;
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
  if (!pos) return null;

  const onDash = isDashboardPath(pathname);
  const line1 = onDash ? "메인" : "운영";
  const line2 = onDash ? "으로" : "관리";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={onDash ? "공개 사이트 메인으로" : "운영 대시보드로 이동"}
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
        gap: 1,
        padding: "6px 4px",
        background: "linear-gradient(160deg, #1e3a5f 0%, #0f172a 100%)",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 700,
        lineHeight: 1.15,
        textAlign: "center",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>{line1}</span>
      <span style={{ whiteSpace: "nowrap" }}>{line2}</span>
    </div>
  );
}
