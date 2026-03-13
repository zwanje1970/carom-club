"use client";

import Link from "next/link";
import { containerMaxW } from "./_lib/config";

/**
 * 관리자 본문 상단 공통 액션: 뒤로 가기, 대시보드로 가기
 * 모든 /admin/* 페이지 상단에 노출 (스크롤 시 상단 고정)
 */
export function AdminPageActions() {
  return (
    <div className={`sticky top-0 z-10 mb-3 bg-gray-50 py-3 dark:bg-slate-800 ${containerMaxW} px-6`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-slate-600 sm:gap-3">
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
