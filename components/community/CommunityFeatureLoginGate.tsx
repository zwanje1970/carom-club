"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type CommunityFeatureLoginGateProps = {
  title: string;
  description: string;
  /** `aria-labelledby`용 id */
  titleId?: string;
  /** `usePathname()`이 없을 때 `next` 쿼리 기본값 */
  fallbackPath?: string;
};

/**
 * 비로그인 시 특정 커뮤니티/기능 진입용 — 전체 화면 딤 + 로그인 유도.
 * 로그인/가입 후 `?next=`로 원래 경로 복귀.
 */
export function CommunityFeatureLoginGate({
  title,
  description,
  titleId = "feature-login-title",
  fallbackPath = "/",
}: CommunityFeatureLoginGateProps) {
  const router = useRouter();
  const pathname = usePathname() ?? fallbackPath;

  const nextQuery = useMemo(
    () => `next=${encodeURIComponent(pathname)}`,
    [pathname]
  );

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -m-2 rounded-lg text-gray-500 hover:text-site-text hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h1 id={titleId} className="text-xl font-bold text-center text-site-text mb-2">
          {title}
        </h1>
        <p className="text-center text-sm text-gray-600 dark:text-slate-400 mb-6">
          {description}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href={`/login?${nextQuery}`}
            className="w-full py-3 rounded-lg bg-site-primary text-white text-center font-semibold hover:opacity-90 shadow-sm"
          >
            로그인
          </Link>
          <Link
            href={`/signup?${nextQuery}`}
            className="w-full py-3 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-center font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
