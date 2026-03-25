import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { NanguSolverIcon } from "@/components/community/NanguSolverIcon";

function BilliardNotesHomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="12" y="8" width="40" height="48" rx="4" className="fill-emerald-700/90 dark:fill-emerald-400/90" />
      <path
        d="M18 16h28M18 24h22M18 32h26M18 40h18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="44" cy="46" r="10" className="fill-amber-400" />
      <path d="M40 46h8M44 42v8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeNoticeCommunity({
  copy,
  showNoteEntry,
  showSolverEntry,
}: {
  copy: Record<string, string>;
  showNoteEntry: boolean;
  showSolverEntry: boolean;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  const showNote = showNoteEntry;
  const showSolver = showSolverEntry;

  if (!showNote && !showSolver) return null;

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {showNote && (
            <Link
              href="/mypage/notes"
              className="flex items-center gap-4 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 to-emerald-50 p-5 shadow-sm transition hover:border-emerald-400 hover:from-emerald-200 hover:to-emerald-100 hover:shadow-md dark:border-emerald-700 dark:bg-gradient-to-br dark:from-emerald-950 dark:to-emerald-900/90 dark:hover:border-emerald-500 dark:hover:from-emerald-900 dark:hover:to-emerald-950"
            >
              <span className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center overflow-visible rounded-xl bg-white/70 shadow-inner dark:bg-emerald-950/50">
                <BilliardNotesHomeIcon className="h-14 w-14" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-site-text">
                  {getCopyValue(c, "site.home.community.notes.title")}
                </h3>
                <p className="mt-0.5 text-sm text-emerald-900/75 dark:text-emerald-200/80">
                  {getCopyValue(c, "site.home.community.notes.desc")}
                </p>
              </div>
            </Link>
          )}
          {showSolver && (
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
          )}
        </div>
      </div>
    </section>
  );
}
