import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

export function HomeQuickApply({ copy }: { copy: Record<string, string> }) {
  const c = copy as Record<AdminCopyKey, string>;
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-site-border bg-site-card p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">
            {getCopyValue(c, "site.home.quickApply.title")}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {getCopyValue(c, "site.home.quickApply.desc")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/tournaments"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-site-primary px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              {getCopyValue(c, "site.home.quickApply.btnApply")}
            </Link>
            <Link
              href="/apply/client"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-site-border bg-site-card px-6 py-3 text-sm font-medium text-site-text transition hover:bg-site-border/50"
            >
              클라이언트 신청
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-site-border bg-site-bg px-6 py-3 text-sm font-medium text-site-text transition hover:bg-site-border/50"
            >
              {getCopyValue(c, "site.home.quickApply.btnLogin")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
