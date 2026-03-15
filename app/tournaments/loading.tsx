/** 대회 목록 로딩 스켈레톤 */
export default function TournamentsLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-site-border" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-site-border" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="rounded-xl border border-site-border bg-site-card overflow-hidden">
              <div className="aspect-[2/1] w-full animate-pulse bg-site-border" />
              <div className="p-4 sm:p-5 space-y-2">
                <div className="h-5 w-3/4 animate-pulse rounded bg-site-border" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-site-border" />
                <div className="h-4 w-full animate-pulse rounded bg-site-border" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
