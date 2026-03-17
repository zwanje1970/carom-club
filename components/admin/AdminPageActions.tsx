"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { containerMaxW } from "./_lib/config";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

/** 액션바 높이·본문 상단 여백 (한 곳에서 관리) */
const ACTION_BAR_HEIGHT = "h-12";
export const ADMIN_ACTION_BAR_PT_CLASS = "pt-12";

type AdminPageActionsProps = {
  /** 헤더 영역 높이(px). NavBar 없으면 64, 있으면 128 */
  topOffset?: number;
  /** 메뉴/문구 (뒤로 가기, 대시보드로 가기 등) */
  copy?: Record<string, string>;
};

/** 이전 페이지가 /admin 내부일 때만 history.back(), 아니면 대시보드(/admin)로 이동 (메인으로 나가지 않음) */
function handleAdminBack(router: ReturnType<typeof useRouter>) {
  try {
    const ref = document.referrer;
    if (!ref) {
      router.push("/admin");
      return;
    }
    const refUrl = new URL(ref);
    if (
      refUrl.origin === window.location.origin &&
      refUrl.pathname.startsWith("/admin") &&
      refUrl.pathname !== window.location.pathname
    ) {
      window.history.back();
    } else {
      router.push("/admin");
    }
  } catch {
    router.push("/admin");
  }
}

/**
 * 관리자 본문 상단 공통 액션: 뒤로 가기, 대시보드로 가기
 * 뒤로 가기는 대시보드(/admin) 안에서만 동작, 메인으로는 나가지 않음.
 */
export function AdminPageActions({ topOffset = 64, copy }: AdminPageActionsProps) {
  const router = useRouter();
  const c = (copy ?? {}) as Record<AdminCopyKey, string>;
  const backLabel = getCopyValue(c, "admin.common.back");
  const dashboardLabel = getCopyValue(c, "admin.common.goToDashboard");

  return (
    <div
      className={`fixed left-0 right-0 z-40 ${ACTION_BAR_HEIGHT} flex items-center border-b border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-800`}
      style={{ top: `${topOffset}px` }}
    >
      <div className={`flex w-full flex-wrap items-center gap-2 px-4 py-1.5 sm:gap-3 sm:px-6 ${containerMaxW} mx-auto`}>
        <button
          type="button"
          onClick={() => handleAdminBack(router)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {backLabel}
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {dashboardLabel}
        </Link>
      </div>
    </div>
  );
}
