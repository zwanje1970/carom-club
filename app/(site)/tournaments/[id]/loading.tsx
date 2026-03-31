/** 대회 상세 로딩 스켈레톤 */
export default function TournamentDetailLoading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="h-6 w-24 animate-pulse rounded bg-site-border" />
        <div className="mt-6 aspect-[2/1] w-full max-w-2xl animate-pulse rounded-xl bg-site-border" />
        <div className="mt-6 space-y-2">
          <div className="h-8 w-3/4 animate-pulse rounded bg-site-border" />
          <div className="h-4 w-full animate-pulse rounded bg-site-border" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-site-border" />
        </div>
        <div className="mt-8 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-site-border" />
          ))}
        </div>
        <div className="mt-8 h-48 w-full animate-pulse rounded-lg bg-site-border" />
      </div>
    </main>
  );
}
