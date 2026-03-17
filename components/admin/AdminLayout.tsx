"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { buildMenuNavBar } from "./adminMenu";
import NavBar from "./dashboard/_components/NavBar";
import FooterBar from "./dashboard/_components/FooterBar";
import { AdminPageActions, ADMIN_ACTION_BAR_PT_CLASS } from "./AdminPageActions";
import { hasAnyDrafts, clearAllDrafts } from "@/lib/admin-drafts";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { FooterSettings } from "@/lib/footer-settings";

type Props = {
  children: React.ReactNode;
  userName: string;
  /** 플랫폼 관리자 > 설정 > 메뉴/문구에서 수정한 값 (없으면 기본 문구 사용) */
  copy?: Record<string, string>;
  /** 푸터 설정 (관리자 설정에서 저장한 값). footerEnabled 시 SiteFooter 사용 */
  footer?: FooterSettings;
};

export function AdminLayout({ children, userName, copy, footer }: Props) {
  const router = useRouter();

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

  const menuNavBar = buildMenuNavBar(userName, copy);
  const hasNavBar = menuNavBar.length > 0;
  const headerHeight = hasNavBar ? 128 : 64; // 메인 헤더 64px, NavBar 있으면 +64px
  const footerText = copy?.["footer.copyright"] ?? "CAROM.CLUB 관리자";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800 dark:text-slate-100">
      {hasNavBar && (
        <NavBar
          menu={menuNavBar}
          className=""
          userName={userName}
          onLogout={handleLogout}
        />
      )}
      <div
        className="relative z-0 min-h-screen w-full"
        style={{ paddingTop: `${headerHeight}px` }}
      >
        <AdminPageActions topOffset={headerHeight} copy={copy} />
        <main
          className={`${ADMIN_ACTION_BAR_PT_CLASS} p-4 sm:p-6 overflow-x-hidden`}
          style={{ minHeight: `calc(100vh - ${headerHeight}px)` }}
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
