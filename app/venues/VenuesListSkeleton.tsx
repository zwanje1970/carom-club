/** Suspense fallback — 구장 카드 그리드 자리 */
export function VenuesListSkeleton() {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-site-border bg-site-card p-4 animate-pulse"
        >
          <div className="h-5 w-full max-w-[75%] rounded bg-site-border" />
          <div className="mt-3 h-4 w-full max-w-[50%] rounded bg-site-border" />
          <div className="mt-2 h-4 w-full rounded bg-site-border" />
        </div>
      ))}
    </div>
  );
}
