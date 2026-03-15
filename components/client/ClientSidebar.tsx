"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  { href: "/client/dashboard", label: "대시보드" },
  { href: "/client/tournaments", label: "내 대회" },
  { href: "/client/participants", label: "참가자 관리" },
  { href: "/client/zones", label: "부/권역 설정" },
  { href: "/client/brackets", label: "대진표 관리" },
  { href: "/client/results", label: "결과 관리" },
  { href: "/client/co-admins", label: "공동관리자 관리" },
  { href: "/client/promo", label: "홍보/페이지 관리" },
  { href: "/client/setup", label: "조직 설정" },
  { href: "/client/billing", label: "이용 현황" },
];

export function ClientSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col shrink-0 border-r border-site-border bg-site-card text-site-text">
      <div className="p-4 border-b border-site-border">
        <Link href="/client/dashboard" className="font-bold text-site-text">
          대회 운영 콘솔
        </Link>
      </div>
      <nav className="p-2 space-y-0.5">
        {menu.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/client/dashboard" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm hover:bg-site-bg hover:text-site-primary ${
                isActive ? "bg-site-bg text-site-primary font-medium" : "text-site-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-2 border-t border-site-border">
        <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-site-primary">
          메인으로
        </Link>
      </div>
    </aside>
  );
}
