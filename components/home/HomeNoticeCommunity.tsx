import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { NanguSolverIcon } from "@/components/community/NanguSolverIcon";

export function HomeNoticeCommunity({ copy }: { copy: Record<string, string> }) {
  const c = copy as Record<AdminCopyKey, string>;
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <Link
            href="/community/nangu"
            className="flex items-center gap-4 rounded-2xl border border-sky-300 bg-gradient-to-br from-sky-100 to-sky-50 p-5 shadow-sm transition hover:border-sky-400 hover:from-sky-200 hover:to-sky-100 hover:shadow-md dark:border-sky-600 dark:bg-gradient-to-br dark:from-sky-950 dark:to-sky-900/90 dark:hover:border-sky-500 dark:hover:from-sky-900 dark:hover:to-sky-950"
          >
            <span className="flex shrink-0 items-center justify-center overflow-visible">
              <NanguSolverIcon size={104} priority />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-site-text">
                {getCopyValue(c, "site.home.community.nangu.title")}
              </h3>
              <p className="mt-0.5 text-sm text-sky-900/70 dark:text-sky-200/75">
                {getCopyValue(c, "site.home.community.nangu.desc")}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
