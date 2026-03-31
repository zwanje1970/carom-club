"use client";

import Link from "next/link";

/** 커뮤니티 허브 상단 난구해결사 진입 카드 — `CommunityMainClient`와 동일 마크업 */
export function CommunityNanguPromoCard() {
  return (
    <div className="mb-6">
      <Link
        href="/community/nangu"
        className="block rounded-xl bg-gradient-to-br from-site-primary/10 to-site-primary/5 border border-site-primary/20 p-5 shadow-sm hover:shadow-md transition-shadow dark:from-site-primary/20 dark:to-site-primary/10 dark:border-site-primary/30"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-site-primary dark:text-site-primary">난구해결사</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">난구를 올리고 해법을 받아보세요</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-site-primary/10 text-site-primary dark:bg-site-primary/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </div>
  );
}
