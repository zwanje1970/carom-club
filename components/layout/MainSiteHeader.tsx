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
          <LogoLink variant="white" data-main-logo />
        </div>
        <nav className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
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
          {isLoggedIn ? (
            <>
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
        </nav>
      </div>
    </header>
  );
}
