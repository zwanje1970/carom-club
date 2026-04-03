export default function CommunityPostDetailLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text" aria-hidden>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 h-4 w-28 animate-pulse rounded bg-site-border" />
        <div className="rounded-xl border border-site-border bg-site-card p-5">
          <div className="h-6 w-3/4 animate-pulse rounded bg-site-border" />
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-site-border" />
          <div className="mt-6 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-site-border" />
            <div className="h-3 w-full animate-pulse rounded bg-site-border" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-site-border" />
          </div>
        </div>
      </div>
    </main>
  );
}
