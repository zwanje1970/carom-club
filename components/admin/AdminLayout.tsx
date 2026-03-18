"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800 dark:text-slate-100">
      <AdminLayoutSidebar
        copy={copy}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div
        className="relative z-0 min-h-screen min-w-0 lg:pl-[280px]"
        style={{ paddingTop: `${ACTION_BAR_HEIGHT}px` }}
      >
        <AdminPageActions
          topOffset={0}
          copy={copy}
          leftSlot={
            <AdminMobileMenuButton onClick={() => setMobileMenuOpen(true)} />
          }
        />
        <main
          className={`${ADMIN_ACTION_BAR_PT_CLASS} p-4 sm:p-6 overflow-x-hidden`}
          style={{ minHeight: `calc(100vh - ${ACTION_BAR_HEIGHT}px)` }}
        >
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
