"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/types/auth";
import { canAccessClientDashboard } from "@/types/auth";

const STORAGE_KEY = "floating-client-dashboard-button-position";
const DEFAULT_OFFSET = 24;
const DRAG_THRESHOLD_PX = 6;

type SavedPosition = { left: number; top: number };

function loadSavedPosition(): SavedPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as SavedPosition).left === "number" &&
      typeof (parsed as SavedPosition).top === "number"
    ) {
      return parsed as SavedPosition;
    }
  } catch {
    // ignore
  }
  return null;
}

function clampPosition(
  left: number,
  top: number,
  width: number,
  height: number
): SavedPosition {
  const w = typeof window === "undefined" ? 400 : window.innerWidth;
  const h = typeof window === "undefined" ? 600 : window.innerHeight;
  return {
    left: Math.max(0, Math.min(w - width, left)),
    top: Math.max(0, Math.min(h - height, top)),
  };
}

/**
 * 오른쪽 아래 고정 클라이언트 대시보드 버튼 (플랫폼 관리자 `AdminFloatButton`과 동일 형태·드래그, 색만 파란색)
 * - CLIENT_ADMIN + 클라이언트 로그인 모드일 때만 표시
 *   - /client 외: "대시보드" → /client/dashboard
 *   - /client 내부: "메인으로" → /
 */
export function ClientFloatButton() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<SavedPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLAnchorElement | HTMLDivElement>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    elLeft: number;
    elTop: number;
  } | null>(null);
  const hasDraggedThisGestureRef = useRef(false);

  const isClientDashboard = user != null && canAccessClientDashboard(user);
  const isInClientDashboard = pathname === "/client" || pathname.startsWith("/client/");
  const showButton = isClientDashboard && !pathname.startsWith("/tv");
  const label = isInClientDashboard ? "메인으로" : "대시보드";
  const href = isInClientDashboard ? "/" : "/client/dashboard";
  const isDraggable = isClientDashboard;
  /** 관리자 검정 플로팅(z-110)과 겹침 완화: 기본 bottom을 한 단 올림 */
  const defaultBottomPx = DEFAULT_OFFSET + 56;

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isDraggable) return;
    const saved = loadSavedPosition();
    if (!saved) {
      setPosition(null);
      return;
    }
    const el = buttonRef.current;
    if (!el) {
      setPosition(saved);
      return;
    }
    const rect = el.getBoundingClientRect();
    const clamped = clampPosition(saved.left, saved.top, rect.width, rect.height);
    setPosition(clamped);
  }, [mounted, isDraggable]);

  useEffect(() => {
    if (!mounted || !isDraggable) return;
    const onResize = () => {
      setPosition((prev) => {
        if (!prev) return prev;
        const el = buttonRef.current;
        if (!el) return prev;
        const rect = el.getBoundingClientRect();
        const clamped = clampPosition(prev.left, prev.top, rect.width, rect.height);
        if (clamped.left !== prev.left || clamped.top !== prev.top) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
          } catch {
            // ignore
          }
          return clamped;
        }
        return prev;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, isDraggable]);

  const savePosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clamped = clampPosition(rect.left, rect.top, rect.width, rect.height);
    setPosition(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      // ignore
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggable) return;
      hasDraggedThisGestureRef.current = false;
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        elLeft: rect.left,
        elTop: rect.top,
      };
      (el as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [isDraggable]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggable || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      if (
        !hasDraggedThisGestureRef.current &&
        (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)
      ) {
        hasDraggedThisGestureRef.current = true;
        setIsDragging(true);
      }
      if (!hasDraggedThisGestureRef.current) return;
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const newLeft = dragStartRef.current.elLeft + dx;
      const newTop = dragStartRef.current.elTop + dy;
      const clamped = clampPosition(newLeft, newTop, rect.width, rect.height);
      setPosition(clamped);
    },
    [isDraggable]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggable) return;
      const el = buttonRef.current;
      if (el && typeof (el as HTMLElement).releasePointerCapture === "function") {
        (el as HTMLElement).releasePointerCapture(e.pointerId);
      }
      if (hasDraggedThisGestureRef.current) {
        savePosition();
      }
      dragStartRef.current = null;
      setIsDragging(false);
    },
    [isDraggable, savePosition]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggable) return;
      const el = buttonRef.current;
      if (el && typeof (el as HTMLElement).releasePointerCapture === "function") {
        (el as HTMLElement).releasePointerCapture(e.pointerId);
      }
      if (hasDraggedThisGestureRef.current) {
        savePosition();
      }
      dragStartRef.current = null;
      setIsDragging(false);
    },
    [isDraggable, savePosition]
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggable && hasDraggedThisGestureRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isDraggable) {
        e.preventDefault();
        router.push(href);
      }
    },
    [isDraggable, href, router]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        if (isDraggable && hasDraggedThisGestureRef.current) {
          e.preventDefault();
          return;
        }
        if (isDraggable) {
          e.preventDefault();
          router.push(href);
        }
      }
    },
    [isDraggable, href, router]
  );

  if (!showButton) return null;

  const baseClass =
    "fixed z-[109] rounded-full bg-blue-600 px-4 py-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sm font-medium text-white shadow-lg transition hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 select-none";

  if (!mounted) {
    return (
      <Link
        href={href}
        className={`${baseClass} right-6`}
        style={{ bottom: defaultBottomPx }}
        aria-label={label}
      >
        {label}
      </Link>
    );
  }

  const style: React.CSSProperties =
    position !== null
      ? { left: position.left, top: position.top, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }
      : {
          right: DEFAULT_OFFSET,
          bottom: defaultBottomPx,
          cursor: "grab",
          touchAction: "none",
        };

  return (
    <div
      ref={buttonRef as React.RefObject<HTMLDivElement>}
      role="link"
      tabIndex={0}
      aria-label={`클라이언트 ${label}`}
      className={baseClass}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {label}
    </div>
  );
}
