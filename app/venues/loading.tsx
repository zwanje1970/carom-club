/** 당구장 목록 로딩 스켈레톤 */
export default function VenuesLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="h-5 w-24 animate-pulse rounded bg-site-border" />
        <div className="mt-4 h-8 w-56 animate-pulse rounded bg-site-border" />
        <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-site-border" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-site-border bg-site-card p-6">
              <div className="h-6 w-2/3 animate-pulse rounded bg-site-border" />
              <div className="mt-2 h-4 w-full animate-pulse rounded bg-site-border" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-site-border" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
