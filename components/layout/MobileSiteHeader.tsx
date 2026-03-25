"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogoLink } from "@/components/intro/LogoLink";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

/** 헤더 배경: Gray 40% (중간 회색) */
const HEADER_BG = "rgb(102, 102, 102)"; // #666

/** 점3개 메뉴: 공지사항, 클라이언트 안내, 문의사항, 알림, 마이페이지, 로그아웃 */
const MENU_ITEMS: { href?: string; label: string; action?: "logout" }[] = [
  { href: "/notice", label: "공지사항" },
  { href: "/apply/client", label: "클라이언트 안내" },
  { href: "/inquiry", label: "문의사항" },
  { href: "/community/notifications", label: "알림" },
  { href: "/mypage", label: "마이페이지" },
  { label: "로그아웃", action: "logout" },
];

export function MobileSiteHeader() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { siteName } = useSiteSettings();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header
      className="sticky top-0 z-20 flex h-[56px] min-h-[56px] max-h-[56px] shrink-0 items-center justify-between px-4 md:hidden"
      style={{ backgroundColor: HEADER_BG, height: "56px", minHeight: "56px" }}
      role="banner"
    >
      {/* 왼쪽: 홈 아이콘 */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        <Link
          href="/"
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white hover:bg-white/20"
          aria-label="메인페이지로 이동"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
      </div>

      {/* 가운데: 텍스트 로고만 정확히 중앙 (인트로 종료 시 로고가 이 위치로 이동). 배경 박스 없음. */}
      <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <LogoLink
            variant="white"
            data-main-logo
            runIntroOnClick
            aria-label={`${siteName} 메인페이지로 이동 (인트로 재생)`}
          />
        </div>
      </div>

      {/* 오른쪽: 점3개 메뉴 */}
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-end" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white hover:bg-white/20"
          aria-label="메뉴"
          aria-expanded={open}
        >
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-gray-200 bg-white py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            role="menu"
          >
            {MENU_ITEMS.map((item) =>
              item.action === "logout" ? (
                <button
                  key="logout"
                  type="button"
                  onClick={handleLogout}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href!}
                  className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </header>
  );
}
