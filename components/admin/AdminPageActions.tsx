"use client";

import Link from "next/link";
import { containerMaxW } from "./_lib/config";

/** 헤더 높이(128px) + 액션바 바로 아래. z-50 NavBar 아래, 본문(z-0) 위 */
const FIXED_TOP_OFFSET = "8rem"; // 128px (헤더 영역)
/** 액션바 높이·본문 상단 여백 (한 곳에서 관리) */
const ACTION_BAR_HEIGHT = "h-14";
export const ADMIN_ACTION_BAR_PT_CLASS = "pt-14";

/**
 * 관리자 본문 상단 공통 액션: 뒤로 가기, 대시보드로 가기
 * /admin 하위 전체 공통. 헤더 아래 고정(fixed), 스크롤해도 같은 위치 유지.
 */
export function AdminPageActions() {
  return (
    <div
      className={`fixed left-0 right-0 z-40 ${ACTION_BAR_HEIGHT} flex items-center border-b border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-800`}
      style={{ top: FIXED_TOP_OFFSET }}
    >
      <div className={`flex w-full flex-wrap items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6 ${containerMaxW} mx-auto`}>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          뒤로 가기
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          대시보드로 가기
        </Link>
      </div>
    </div>
  );
}
