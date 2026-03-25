"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoLink } from "@/components/intro/LogoLink";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import type { SessionUser } from "@/types/auth";

const DEFAULT_HEADER_BG = "#0a0a0a";
const DEFAULT_HEADER_TEXT = "#d1d5db";
const DEFAULT_HEADER_ACTIVE = "#fbbf24";

const NAV = [
  { href: "/", label: "HOME" },
  { href: "/tournaments", label: "대회" },
  { href: "/venues", label: "당구장" },
  { href: "/community", label: "커뮤니티" },
] as const;

type MainSiteHeaderProps = { hideOnMobile?: boolean };

export function MainSiteHeader({ hideOnMobile = false }: MainSiteHeaderProps) {
  const pathname = usePathname() ?? "";
  const settings = useSiteSettings();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);

  const headerBg = settings.headerBgColor ?? DEFAULT_HEADER_BG;
  const headerText = settings.headerTextColor ?? DEFAULT_HEADER_TEXT;
  const headerActive = settings.headerActiveColor ?? DEFAULT_HEADER_ACTIVE;

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !user) return;
    fetch("/api/community/notifications", { credentials: "include" })
      .then((res) => res.ok ? res.json() : { unreadCount: 0 })
      .then((data) => setNotificationUnread(data.unreadCount ?? 0))
      .catch(() => setNotificationUnread(0));
  }, [mounted, user]);

  const isLoggedIn = mounted && !!user;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const linkStyle = (active: boolean) =>
    active
      ? { color: headerActive }
      : { color: headerText };

  return (
    <header
      className={`sticky top-0 z-20 h-16 min-h-[64px] border-b relative flex items-center transition-colors ${hideOnMobile ? "hidden md:flex" : ""}`}
      style={{
        height: "64px",
        backgroundColor: headerBg,
        borderColor: headerBg,
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <LogoLink
            variant="white"
            data-main-logo
            runIntroOnClick
            aria-label="홈 (인트로 보기)"
          />
        </div>
        <nav className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0 md:min-h-[40px]">
          {NAV.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium transition hover:opacity-90"
                style={linkStyle(isActive)}
              >
                {label}
              </Link>
            );
          })}
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-6 md:min-h-[40px] md:min-w-[200px] lg:min-w-[280px]">
          {isLoggedIn ? (
            <>
              <Link
                href="/community/notifications"
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-full hover:opacity-90"
                style={{ color: headerText }}
                aria-label={notificationUnread > 0 ? `알림 ${notificationUnread}건` : "알림"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notificationUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-xs font-medium bg-red-500 text-white px-1">
                    {notificationUnread > 99 ? "99+" : notificationUnread}
                  </span>
                )}
              </Link>
              <Link
                href="/mypage"
                className="text-sm font-medium transition hover:opacity-90"
                style={linkStyle(pathname === "/mypage")}
              >
                마이페이지
              </Link>
              {user?.loginMode === "client" && (
                <Link
                  href="/client/dashboard"
                  className="text-sm font-medium transition hover:opacity-90"
                  style={linkStyle(pathname?.startsWith("/client") ?? false)}
                >
                  클라이언트 대시보드
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium transition hover:opacity-90"
                style={{ color: headerText }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium transition hover:opacity-90"
              style={linkStyle(pathname === "/login" || pathname === "/signup")}
            >
              로그인 · 회원가입
            </Link>
          )}
          </div>
        </nav>
      </div>
    </header>
  );
}
