import Link from "next/link";

export default function AdminSitePage() {
  return (
    <div className="rounded-xl border border-site-border bg-white p-5 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-site-text">사이트 관리</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
        사이트 운영 항목을 한 곳에서 관리할 수 있습니다. 메뉴에서 원하는 항목을 선택하세요.
      </p>
      <div className="mt-3">
        <Link
          href="/admin/dashboard"
          className="inline-flex rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
