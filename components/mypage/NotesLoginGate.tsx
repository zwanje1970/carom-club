"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * 비로그인 시 /mypage/notes/* 진입용 — 본문 대신 전체 화면 딤 + 로그인 유도 모달.
 * 배경 클릭으로는 닫히지 않음(강제 로그인 UX). 닫기는 이전 페이지 또는 홈.
 */
export function NotesLoginGate() {
  const router = useRouter();
  const pathname = usePathname() ?? "/mypage/notes";

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
      {/* 딤: 클릭해도 닫히지 않음 */}
      <div className="absolute inset-0 bg-black/60" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-login-title"
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

        <h1 id="notes-login-title" className="text-xl font-bold text-center text-site-text mb-2">
          당구노트
        </h1>
        <p className="text-center text-sm text-gray-600 dark:text-slate-400 mb-6">
          당구노트는 로그인 후 이용 가능합니다.
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
