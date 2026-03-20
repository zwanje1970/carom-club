"use client";

import Link from "next/link";

type Props = {
  href: string;
  label?: string;
};

/** 글쓰기 FAB (우측 하단, 빨강 유지) */
export function CommunityWriteFab({ href, label = "글쓰기" }: Props) {
  return (
    <Link
      href={href}
      className="fixed bottom-6 right-4 z-40 flex h-14 min-w-[56px] items-center justify-center rounded-full bg-site-primary px-5 text-sm font-semibold text-white shadow-md hover:opacity-90 active:scale-[0.98] sm:bottom-8 sm:right-6"
      aria-label={label}
    >
      <span className="sm:hidden" aria-hidden>
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
