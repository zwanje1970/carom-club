"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 하단 네비: 대회, 노트(중앙 강조), 당구장, 커뮤니티, 마이. 노트 = /mypage/notes */
const ITEMS_LEFT = [
  { href: "/tournaments", label: "대회", icon: TrophyIcon },
] as const;
const ITEMS_CENTER = { href: "/mypage/notes", label: "노트", icon: NoteIcon, emphasize: true } as const;
const ITEMS_RIGHT = [
  { href: "/venues", label: "당구장", icon: VenueIcon },
  { href: "/community", label: "커뮤니티", icon: CommunityIcon },
  { href: "/mypage", label: "마이", icon: MypageIcon },
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
function NoteIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  emphasize,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ active: boolean }>;
  pathname: string;
  emphasize?: boolean;
}) {
  const isActive =
    pathname === href ||
    (href === "/mypage/notes" && pathname.startsWith("/mypage/notes")) ||
    (href !== "/community" && href !== "/mypage" && pathname.startsWith(href + "/")) ||
    (href === "/mypage" && (pathname === "/mypage" || (pathname.startsWith("/mypage/") && !pathname.startsWith("/mypage/notes"))));
  const base = "flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-xs transition min-h-[72px] min-w-[44px] border-t-2 ";
  const activeClass = "text-site-primary font-medium border-site-primary bg-site-primary/5";
  const inactiveClass = "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200";
  const emphasisClass = emphasize ? "bg-site-primary/10 dark:bg-site-primary/20" : "";
  return (
    <Link
      href={href}
      className={`${base} ${isActive ? activeClass : inactiveClass} ${isActive && emphasize ? emphasisClass : ""}`}
    >
      <span className={`inline-flex items-center justify-center ${emphasize ? "min-h-[32px] min-w-[32px]" : "min-h-[28px] min-w-[28px]"}`}>
        <Icon active={isActive} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

/** 모바일(768px 이하) 전용 하단 고정 네비게이션. 대회 | 노트(중앙 강조) | 당구장 | 커뮤니티 | 마이 */
export function BottomNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-white border-t border-gray-200 flex justify-around items-stretch md:hidden dark:bg-slate-900 dark:border-slate-700"
      aria-label="하단 메뉴"
    >
      {ITEMS_LEFT.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} />
      ))}
      <NavLink href={ITEMS_CENTER.href} label={ITEMS_CENTER.label} icon={ITEMS_CENTER.icon} pathname={pathname} emphasize />
      {ITEMS_RIGHT.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} />
      ))}
    </nav>
  );
}
