/** 커뮤니티 홈: 탭·필·목록 틀을 먼저 표시해 “로딩 중” 인지 즉시 전달 */
export default function CommunityLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
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
