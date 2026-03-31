/** Suspense fallback — 대회 목록 영역 */
export function TournamentsListSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden>
      <div className="h-10 w-full max-w-md animate-pulse rounded bg-site-border" />
      <ul className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="rounded-lg border border-site-border bg-site-card overflow-hidden"
          >
            <div className="aspect-[2/1] animate-pulse bg-site-border" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-full max-w-[85%] rounded bg-site-border" />
              <div className="h-3 w-full max-w-[50%] rounded bg-site-border" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
