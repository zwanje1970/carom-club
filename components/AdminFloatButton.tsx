"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = { role?: string };

/**
 * 오른쪽 아래 고정 관리자 버튼
 * - /login: 항상 표시
 * - /admin/*: 관리자(PLATFORM_ADMIN) 로그인 시 표시
 * - 일반 페이지(/, /tournaments 등): 관리자 로그인 시에만 표시, 비로그인 시 숨김
 */
export function AdminFloatButton() {
  const pathname = usePathname() ?? "";
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const isAdminLoggedIn = user?.role === "PLATFORM_ADMIN";

  const showAdminButton = pathname === "/login" || isAdminLoggedIn;

  if (!showAdminButton) return null;

  const href = pathname === "/login" ? "/admin/login" : "/admin";

  return (
    <Link
      href={href}
      className="fixed bottom-6 right-6 z-[110] rounded-full bg-site-text px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90"
      aria-label="관리자"
    >
      관리자
    </Link>
  );
}
