import Link from "next/link";
import { PAGE_LABELS } from "@/lib/content/constants";
import { PAGE_BUILDER_KEYS } from "@/lib/content/page-section-page-rules";

export default function AdminSitePageBuilderNextPage() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-site-border bg-white p-5 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-site-text">페이지빌더 (새 편집기)</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          기존 페이지빌더는 유지한 상태로, 새 편집기 흐름을 별도 경로에서 먼저 검증합니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PAGE_BUILDER_KEYS.map((pageKey) => (
          <Link
            key={pageKey}
            href={`/admin/site/page-builder-next/${pageKey}`}
            className="rounded-xl border border-site-border bg-white px-4 py-4 text-sm text-site-text hover:bg-gray-50 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            {PAGE_LABELS[pageKey]}
          </Link>
        ))}
      </div>
    </div>
  );
}
