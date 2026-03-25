"use client";

import Link from "next/link";

const BASE_ITEMS = [
  { href: "/mypage?tab=entries", label: "참가 대회" },
  { href: "/mypage?tab=applications", label: "신청 내역" },
  { href: "/mypage/notes", label: "난구노트" },
  { href: "/mypage/edit", label: "내 정보 수정" },
  { href: "/notifications-popup", label: "알림" },
] as const;

export interface MypageQuickMenuProps {
  /** 클라이언트 회원이 일반회원 모드로 로그인한 경우에만 true. 일반회원(USER)은 false. */
  showClient?: boolean;
  showNoteEntry: boolean;
}

export function MypageQuickMenu({ showClient = false, showNoteEntry }: MypageQuickMenuProps) {
  const items = [
    ...BASE_ITEMS,
    ...(showClient ? [{ href: "/client/dashboard" as const, label: "클라이언트" as const }] : []),
  ].filter((item) => showNoteEntry || item.href !== "/mypage/notes");
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ href, label }) => (
        <Link
          key={href + label}
          href={href}
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-4 text-sm font-medium text-site-text shadow-sm hover:bg-gray-50 active:bg-gray-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
