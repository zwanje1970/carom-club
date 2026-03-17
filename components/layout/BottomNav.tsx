"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 하단 네비: 당구대회, 당구장홍보, 마이페이지, 커뮤니티. 당구노트는 마이페이지 퀵메뉴에서 이동. */
const ITEMS = [
  { href: "/tournaments", label: "당구대회", icon: TrophyIcon },
  { href: "/venues", label: "당구장홍보", icon: VenueIcon },
  { href: "/mypage", label: "마이페이지", icon: MypageIcon },
  { href: "/community", label: "커뮤니티", icon: CommunityIcon },
] as const;

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 3v2m0 4v8m4-16v2m0 4v8M6 21h12a2 2 0 002-2v-4H4v4a2 2 0 002 2zm4-12h4" />
    </svg>
  );
}
function VenueIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function CommunityIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 12h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  );
}
function MypageIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

/** 모바일(768px 이하) 전용 하단 고정 네비게이션. /admin에서는 사용하지 않음. */
export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-white border-t border-gray-200 flex justify-around items-center md:hidden dark:bg-slate-900 dark:border-slate-700"
      aria-label="하단 메뉴"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href !== "/community" && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition min-h-[72px] min-w-[44px] border-t-2 ${
              isActive
                ? "text-site-primary font-medium border-site-primary bg-site-primary/5"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="inline-flex items-center justify-center min-h-[28px] min-w-[28px]">
              <Icon active={isActive} />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
