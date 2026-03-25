"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mdiMenu, mdiChevronDown, mdiChevronRight, mdiLogout } from "@mdi/js";
import Icon from "./_components/Icon";
import { getAdminMenuAside, getExpandedGroupIndex } from "./adminMenuConfig";
import type { MenuAsideItem } from "./_interfaces";

const SIDEBAR_WIDTH = 280;
const MOBILE_BREAKPOINT = 1024;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

type SidebarProps = {
  copy?: Record<string, string>;
  onLogout?: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function AdminLayoutSidebar({ copy, onLogout, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const menu = useMemo(() => getAdminMenuAside(copy), [copy]);
  const expandedIndex = useMemo(() => getExpandedGroupIndex(pathname ?? ""), [pathname]);
  const [openIndex, setOpenIndex] = useState(expandedIndex >= 0 ? expandedIndex : -1);

  useEffect(() => {
    if (expandedIndex >= 0) setOpenIndex(expandedIndex);
    else setOpenIndex(-1);
  }, [expandedIndex]);

  const isActive = (href: string) => {
    if (!pathname || !href) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-slate-700">
        <Link href="/admin" className="font-bold text-gray-900 dark:text-slate-100" onClick={onMobileClose}>
          캐롬클럽 관리자
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {menu.map((item, idx) => {
            if (item.href && !item.menu) {
              const active = isActive(item.href);
              return (
                <li key={idx}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-site-primary text-white dark:bg-site-primary"
                        : "text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {item.icon && <Icon path={item.icon} size={20} />}
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            }
            if (item.menu && item.menu.length > 0) {
              const isOpen = isMobile || openIndex === idx;
              const hasActiveChild = item.menu.some((m) => m.href && isActive(m.href));
              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) return;
                      setOpenIndex(isOpen ? -1 : idx);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      hasActiveChild
                        ? "bg-site-primary/10 font-medium text-site-primary dark:bg-site-primary/20"
                        : "text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon && <Icon path={item.icon} size={20} />}
                      <span>{item.label}</span>
                    </span>
                    {!isMobile && <Icon path={isOpen ? mdiChevronDown : mdiChevronRight} size={20} />}
                  </button>
                  <ul
                    className={`overflow-hidden pl-4 ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
                    style={{ transition: "max-height 0.2s ease-out, opacity 0.15s" }}
                  >
                    {(() => {
                      const firstActiveSubIdx = item.menu.findIndex((m) => m.href && isActive(m.href));
                      return item.menu.map((sub, subIdx) => {
                        if (!sub.href) return null;
                        const subActive = isActive(sub.href) && firstActiveSubIdx === subIdx;
                        return (
                        <li key={subIdx} className="py-0.5">
                          <Link
                            href={sub.href}
                            onClick={onMobileClose}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                              subActive
                                ? "bg-site-primary text-white dark:bg-site-primary"
                                : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            }`}
                          >
                            {sub.icon && <Icon path={sub.icon} size={18} />}
                            <span>{sub.label}</span>
                          </Link>
                        </li>
                      );
                      });
                    })()}
                  </ul>
                </li>
              );
            }
            return null;
          })}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-gray-200 px-2 py-2 dark:border-slate-700">
        <button
          type="button"
          onClick={() => {
            onMobileClose();
            onLogout?.();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Icon path={mdiLogout} size={20} />
          <span>로그아웃</span>
        </button>
      </div>
    </>
  );

  /** 데스크톱: 전체 높이. 모바일: 상단 액션바(h-12) 아래부터만 펼쳐져 햄버거·뒤로가기와 겹치지 않음 */
  const asideClassDesktop =
    "fixed left-0 top-0 z-20 flex h-full w-[280px] flex-col bg-white shadow-lg dark:bg-slate-900 dark:shadow-none";
  const asideClassMobile =
    "fixed left-0 top-12 z-50 flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[280px] flex-col bg-white shadow-lg dark:bg-slate-900 dark:shadow-none";
  /** 액션바(z-60) 아래 영역만 딤 — 메뉴(z-50)는 그 위 */
  const overlayClass = "fixed inset-x-0 bottom-0 top-12 z-40 bg-black/50";

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div className={overlayClass} aria-hidden onClick={onMobileClose} />
        )}
        <aside
          className={`${asideClassMobile} transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="관리자 메뉴"
          aria-hidden={!mobileOpen}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className={asideClassDesktop} aria-label="관리자 메뉴">
      {sidebarContent}
    </aside>
  );
}

type MobileMenuButtonProps = {
  onClick: () => void;
};

export function AdminMobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 lg:hidden"
      aria-label="메뉴 열기"
    >
      <Icon path={mdiMenu} size={24} />
    </button>
  );
}

export const ADMIN_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
