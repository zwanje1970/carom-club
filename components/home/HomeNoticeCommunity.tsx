import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

export function HomeNoticeCommunity({ copy }: { copy: Record<string, string> }) {
  const c = copy as Record<AdminCopyKey, string>;
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xl font-bold text-site-text sm:text-2xl">
          {getCopyValue(c, "site.home.community.title")}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {getCopyValue(c, "site.home.community.subtitle")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/community"
            className="flex items-center gap-4 rounded-2xl border border-site-border bg-site-card p-5 shadow-sm transition hover:border-site-primary/30 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-site-primary/10 text-site-primary">
              📢
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-site-text">
                {getCopyValue(c, "site.home.community.notice.title")}
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {getCopyValue(c, "site.home.community.notice.desc")}
              </p>
            </div>
          </Link>
          <Link
            href="/community"
            className="flex items-center gap-4 rounded-2xl border border-site-border bg-site-card p-5 shadow-sm transition hover:border-site-primary/30 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-site-secondary/20 text-site-text">
              💬
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-site-text">
                {getCopyValue(c, "site.home.community.community.title")}
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {getCopyValue(c, "site.home.community.community.desc")}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
