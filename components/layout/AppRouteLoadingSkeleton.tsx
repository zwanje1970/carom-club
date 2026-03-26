/**
 * 공통 라우트 전환 스켈레톤 — loading.tsx에서 공유.
 * variant로 주요 섹션별 실루엣만 조정한다.
 */
export type AppRouteLoadingVariant = "default" | "community" | "wide";

export function AppRouteLoadingSkeleton({
  variant = "default",
}: {
  variant?: AppRouteLoadingVariant;
}) {
  const maxW =
    variant === "wide"
      ? "max-w-5xl"
      : variant === "community"
        ? "max-w-3xl"
        : "max-w-3xl";

  if (variant === "community") {
    return (
      <main
        className="min-h-screen bg-site-bg text-site-text"
        aria-busy="true"
        aria-label="페이지 로딩 중"
      >
        <div className={`mx-auto w-full ${maxW} px-4 py-6 sm:px-6`}>
          <div className="mt-4 space-y-4 pb-20">
            <div className="h-4 w-28 animate-pulse rounded bg-site-border" aria-hidden />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-site-border" aria-hidden />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-site-border" aria-hidden />
              ))}
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-hidden>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <li key={i} className="py-3.5 px-1">
                  <div className="h-4 w-full max-w-lg animate-pulse rounded bg-site-border" />
                  <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-site-border" />
                  <div className="mt-2 h-3 w-32 animate-pulse rounded bg-site-border" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    );
  }

  if (variant === "wide") {
    return (
      <main
        className="min-h-screen bg-site-bg text-site-text"
        aria-busy="true"
        aria-label="페이지 로딩 중"
      >
        <div className={`mx-auto w-full ${maxW} px-4 py-10 sm:px-6 sm:py-12`}>
          <div className="h-8 w-48 max-w-full animate-pulse rounded bg-site-border" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-site-border" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-site-border bg-site-card/40 p-5"
                aria-hidden
              >
                <div className="h-6 w-2/3 animate-pulse rounded bg-site-border" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-site-border" />
                <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-site-border" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-site-bg text-site-text"
      aria-busy="true"
      aria-label="페이지 로딩 중"
    >
      <div className={`mx-auto w-full ${maxW} px-4 py-6 sm:px-6`}>
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-site-border" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-site-border" />
            <div className="h-3 w-28 animate-pulse rounded bg-site-border" />
          </div>
        </div>
        <div className="space-y-3 pb-20">
          <div className="h-4 w-full max-w-xl animate-pulse rounded bg-site-border" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-site-border" />
          <div className="h-4 w-2/3 max-w-md animate-pulse rounded bg-site-border" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-site-border bg-site-card/50"
              aria-hidden
            >
              <div className="h-full w-full animate-pulse rounded-xl bg-site-border/40" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
