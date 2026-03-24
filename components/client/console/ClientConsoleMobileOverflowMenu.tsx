"use client";

import Link from "next/link";

/** 사이드바가 숨겨진 모바일에서 사업장·홍보 등 보조 진입 */
export function ClientConsoleMobileOverflowMenu() {
  return (
    <details className="relative z-50 lg:hidden">
      <summary className="list-none cursor-pointer rounded-md border border-zinc-300 px-2.5 py-2 text-[11px] font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
        더보기
      </summary>
      <div className="absolute right-0 top-full mt-1 min-w-[11rem] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
        <Link
          href="/client/setup"
          className="block min-h-[44px] px-3 py-2.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          내 정보/사업장 관리
        </Link>
        <Link
          href="/client/promo"
          className="block min-h-[44px] px-3 py-2.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          콘텐츠/홍보
        </Link>
        <Link
          href="/client/dashboard"
          className="block min-h-[44px] px-3 py-2.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          운영 대시보드
        </Link>
      </div>
    </details>
  );
}
