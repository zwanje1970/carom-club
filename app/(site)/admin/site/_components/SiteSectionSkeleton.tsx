import Link from "next/link";

type Props = {
  title: string;
  description: string;
  moveTo?: { href: string; label: string };
};

export function SiteSectionSkeleton({ title, description, moveTo }: Props) {
  return (
    <div className="rounded-xl border border-site-border bg-white p-5 dark:bg-slate-900">
      <h1 className="text-lg font-semibold text-site-text">{title}</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/site"
          className="inline-flex rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          사이트 관리 메인
        </Link>
        {moveTo ? (
          <Link
            href={moveTo.href}
            className="inline-flex rounded-lg border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            {moveTo.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
