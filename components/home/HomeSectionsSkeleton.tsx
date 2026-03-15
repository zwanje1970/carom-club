/** 메인 페이지 대회/당구장 영역 로딩 스켈레톤 (스트리밍 시 fallback) */
export function HomeSectionsSkeleton() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded bg-site-border" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-site-border bg-site-card overflow-hidden">
            <div className="aspect-[2/1] animate-pulse bg-site-border" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-site-border" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-site-border" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 h-7 w-32 animate-pulse rounded bg-site-border" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-site-border" />
        ))}
      </div>
    </section>
  );
}
