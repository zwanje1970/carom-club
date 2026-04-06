import Link from "next/link";

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

export default function AdminSitePage() {
  return (
    <div className="rounded-xl border border-site-border bg-white p-5 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-site-text">사이트 관리</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
        사이트 운영 항목을 한 곳에서 관리할 수 있습니다. 아래 메뉴에서 원하는 항목을 선택하세요.
      </p>
      <div className="mt-3">
        <Link
          href="/admin/dashboard"
          className="inline-flex rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          대시보드로 이동
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SITE_MENU.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-site-border px-4 py-3 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
