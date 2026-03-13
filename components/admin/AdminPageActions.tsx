"use client";

import Link from "next/link";
import { containerMaxW } from "./_lib/config";

/** 액션바 높이·본문 상단 여백 (한 곳에서 관리) */
const ACTION_BAR_HEIGHT = "h-12";
export const ADMIN_ACTION_BAR_PT_CLASS = "pt-12";

type AdminPageActionsProps = {
  /** 헤더 영역 높이(px). NavBar 없으면 64, 있으면 128 */
  topOffset?: number;
};

/**
 * 관리자 본문 상단 공통 액션: 뒤로 가기, 대시보드로 가기
 * 헤더 바로 아래 고정(fixed). NavBar 없을 때 구간 없이 붙음.
 */
export function AdminPageActions({ topOffset = 64 }: AdminPageActionsProps) {
  return (
    <div
      className={`fixed left-0 right-0 z-40 ${ACTION_BAR_HEIGHT} flex items-center border-b border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-800`}
      style={{ top: `${topOffset}px` }}
    >
      <div className={`flex w-full flex-wrap items-center gap-2 px-4 py-1.5 sm:gap-3 sm:px-6 ${containerMaxW} mx-auto`}>
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
