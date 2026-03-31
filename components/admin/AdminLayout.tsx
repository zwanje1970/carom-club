"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { mdiChevronDoubleRight } from "@mdi/js";
import Icon from "./_components/Icon";
import FooterBar from "./dashboard/_components/FooterBar";
import { AdminPageActions, ADMIN_ACTION_BAR_PT_CLASS } from "./AdminPageActions";
import { AdminLayoutSidebar, AdminMobileMenuButton, ADMIN_SIDEBAR_WIDTH } from "./AdminLayoutSidebar";
import { hasAnyDrafts, clearAllDrafts } from "@/lib/admin-drafts";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { FooterSettings } from "@/lib/footer-settings";

const ACTION_BAR_HEIGHT = 48;

type Props = {
  children: React.ReactNode;
  userName: string;
  /** 플랫폼 관리자 > 설정 > 메뉴/문구에서 수정한 값 (없으면 기본 문구 사용) */
  copy?: Record<string, string>;
  /** 푸터 설정 (관리자 설정에서 저장한 값). footerEnabled 시 SiteFooter 사용 */
  footer?: FooterSettings;
};

export function AdminLayout({ children, copy, footer }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceSidebarOpen, setWorkspaceSidebarOpen] = useState(false);

  const isEditorWorkspace = pathname?.startsWith("/admin/page-builder");
  const desktopSidebarVisible = !isEditorWorkspace || workspaceSidebarOpen;

  const handleLogout = async () => {
    if (hasAnyDrafts()) {
      const ok = window.confirm(
        "저장하지 않은 내용이 있습니다. 로그아웃하면 해당 내용은 유지되지 않습니다. 로그아웃하시겠습니까?"
      );
      if (!ok) return;
      clearAllDrafts();
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const footerText = copy?.["footer.copyright"] ?? "CAROM.CLUB 관리자";

  return (
    /* z-30: 메인 레이아웃 MainSiteHeader(z-20) 위에 그려져 모바일에서 햄버거·액션바가 가려지지 않음 */
    <div className="relative z-30 min-h-screen bg-gray-50 dark:bg-slate-800 dark:text-slate-100">
      {desktopSidebarVisible || mobileMenuOpen ? (
        <AdminLayoutSidebar
          copy={copy}
          onLogout={handleLogout}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      ) : null}
      {/* 고정 사이드바(280px) 옆 본문: pl만으로 오프셋. 상단 여백은 main의 pt-12 한 곳에서만 처리(이중 여백 방지). */}
      <div className={`relative min-h-screen w-full min-w-0 ${desktopSidebarVisible ? "lg:pl-[280px]" : ""}`}>
        <AdminPageActions
          topOffset={0}
          copy={copy}
          desktopSidebarVisible={desktopSidebarVisible}
          fullWidth={isEditorWorkspace}
          leftSlot={
            <div className="flex items-center gap-1">
              <AdminMobileMenuButton onClick={() => setMobileMenuOpen(true)} />
              {isEditorWorkspace && !desktopSidebarVisible ? (
                <button
                  type="button"
                  onClick={() => setWorkspaceSidebarOpen(true)}
                  className="hidden items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 lg:inline-flex"
                >
                  <Icon path={mdiChevronDoubleRight} size={0.7} />
                  메뉴 열기
                </button>
              ) : null}
            </div>
          }
        />
        <main
          className={`${ADMIN_ACTION_BAR_PT_CLASS} w-full min-w-0 ${
            isEditorWorkspace ? "p-0" : "p-4 sm:p-6"
          } overflow-x-hidden`}
          style={{ minHeight: `calc(100vh - ${ACTION_BAR_HEIGHT}px)` }}
        >
          {isEditorWorkspace && desktopSidebarVisible ? (
            <div className="hidden lg:flex">
              <button
                type="button"
                onClick={() => setWorkspaceSidebarOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                메뉴 접기
              </button>
            </div>
          ) : null}
          {children}
        </main>
        {footer?.footerEnabled ? (
          <SiteFooter footer={footer} defaultTagline={footerText} />
        ) : (
          <FooterBar>{footerText}</FooterBar>
        )}
      </div>
    </div>
  );
}
