/** Suspense fallback — 대회 목록 영역 */
export function TournamentsListSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden>
      <div className="h-10 w-full max-w-md animate-pulse rounded bg-site-border" />
      <ul className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="rounded-lg border border-site-border bg-site-card p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-full max-w-[85%] rounded bg-site-border" />
                <div className="h-3 w-full max-w-[60%] rounded bg-site-border" />
              </div>
              <div className="h-6 w-16 shrink-0 rounded-full bg-site-border" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
