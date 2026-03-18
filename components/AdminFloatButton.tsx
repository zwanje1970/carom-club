"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "floating-dashboard-button-position";
const DEFAULT_OFFSET = 24; // 24px from right and bottom (tailwind right-6 bottom-6)
const DRAG_THRESHOLD_PX = 6;

type SessionUser = { role?: string };

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
 * 오른쪽 아래 고정 관리자/대시보드 버튼
 * - 비로그인 또는 일반회원: "관리자" → /admin/login
 * - 관리자(PLATFORM_ADMIN): "대시보드" → /admin, 드래그로 위치 이동 가능, 위치 localStorage 저장
 * - /login 에서만 비로그인 시에도 "관리자" 버튼 표시
 */
export function AdminFloatButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
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

  const isAdminLoggedIn = user?.role === "PLATFORM_ADMIN";
  const showButton = pathname === "/login" || isAdminLoggedIn;
  const label = isAdminLoggedIn ? "대시보드" : "관리자";
  const href = isAdminLoggedIn ? "/admin" : "/admin/login";
  const isDraggable = isAdminLoggedIn;

  // Session: client-only fetch
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  // Mount + load saved position (client-only, avoid hydration mismatch)
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

  // Resize: clamp position so button stays in view
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
    "fixed z-[110] rounded-full bg-site-text px-4 py-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-sm font-medium text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2 select-none";

  // Non-draggable: simple link (비로그인 시 "관리자")
  if (!mounted) {
    return (
      <Link
        href={href}
        className={`${baseClass} right-6 bottom-6`}
        aria-label={label}
      >
        {label}
      </Link>
    );
  }

  if (!isDraggable) {
    return (
      <Link
        href={href}
        className={`${baseClass} right-6 bottom-6`}
        aria-label={label}
      >
        {label}
      </Link>
    );
  }

  // Draggable "대시보드" button: div with role="link" for accessibility, position from state or default
  const style: React.CSSProperties =
    position !== null
      ? { left: position.left, top: position.top, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }
      : { right: DEFAULT_OFFSET, bottom: DEFAULT_OFFSET, cursor: "grab", touchAction: "none" };

  return (
    <div
      ref={buttonRef as React.RefObject<HTMLDivElement>}
      role="link"
      tabIndex={0}
      aria-label={label}
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
