/** 커뮤니티 홈: 전역 스피너 대신 상단 레이아웃만 짧게 유지(실제 목록은 RSC에서 곧바로 채워짐) */
export default function CommunityLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mt-4 space-y-3">
          <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-site-border" />
          <div className="h-9 w-full max-w-xs animate-pulse rounded-md bg-site-border" />
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="py-3.5 px-1">
                <div className="h-4 w-full max-w-lg animate-pulse rounded bg-site-border" />
                <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-site-border" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
