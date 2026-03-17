"use client";

import { useState } from "react";
import Link from "next/link";

type Group = {
  id: string;
  label: string;
  links: { href: string; label: string }[];
};

const GROUPS: Group[] = [
  {
    id: "activity",
    label: "내 활동",
    links: [
      { href: "/mypage?tab=entries", label: "참가 대회" },
      { href: "/mypage?tab=applications", label: "신청 내역" },
      { href: "/mypage/community", label: "커뮤니티 활동" },
    ],
  },
  {
    id: "account",
    label: "계정 관리",
    links: [
      { href: "/mypage/edit", label: "회원정보 수정" },
      { href: "/login/forgot-password", label: "비밀번호 재설정" },
    ],
  },
  {
    id: "client",
    label: "클라이언트",
    links: [
      { href: "/client/dashboard", label: "클라이언트 대시보드" },
      { href: "/mypage/client-apply", label: "클라이언트 신청" },
    ],
  },
  {
    id: "support",
    label: "고객센터",
    links: [
      { href: "/community/boards/notice", label: "공지사항" },
      { href: "/apply/client", label: "클라이언트 안내" },
    ],
  },
];

export function MypageAccordion() {
  const [openId, setOpenId] = useState<string | null>(GROUPS[0].id);

  return (
    <div className="space-y-1">
      {GROUPS.map((group) => {
        const isOpen = openId === group.id;
        return (
          <div
            key={group.id}
            className="rounded-xl border border-gray-200 overflow-hidden dark:border-slate-600"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : group.id)}
              className="flex w-full items-center justify-between bg-white px-4 py-3.5 text-left text-sm font-semibold text-site-text hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <span>{group.label}</span>
              <span className="text-gray-400" aria-hidden>
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-slate-600">
                {group.links.map(({ href, label }) => (
                  <Link
                    key={href + label}
                    href={href}
                    className="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
