"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SITE_MENU = [
  { href: "/admin/site/page-builder-new", label: "페이지빌더" },
  { href: "/admin/site/content", label: "콘텐츠 관리" },
  { href: "/admin/site/community", label: "커뮤니티 관리" },
  { href: "/admin/site/copy", label: "문구 관리" },
  { href: "/admin/site/header", label: "헤더 관리" },
  { href: "/admin/site/hero", label: "히어로 편집" },
  { href: "/admin/site/footer", label: "푸터 편집" },
  { href: "/admin/site/intro", label: "인트로 설정" },
  { href: "/admin/site/card-style", label: "카드 스타일 관리" },
] as const;

export default function AdminSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBuilderWorkspace = pathname?.startsWith("/admin/site/page-builder-new");

  if (isBuilderWorkspace) {
    return <section className="w-full min-w-0">{children}</section>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-site-border bg-white p-3 dark:bg-slate-900">
        <h2 className="mb-2 text-sm font-semibold text-site-text">사이트 관리</h2>
        <Link
          href="/admin/dashboard"
          className="mb-3 block rounded-lg px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          대시보드로 이동
        </Link>
        <ul className="space-y-1.5">
          {SITE_MENU.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
