export default function MypageLoading() {
  return (
    <main className="min-h-screen bg-site-bg p-4 md:p-8" aria-hidden>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="h-7 w-32 animate-pulse rounded bg-site-border" />
        <div className="h-24 animate-pulse rounded-xl border border-site-border bg-site-card" />
        <div className="h-12 animate-pulse rounded-xl border border-site-border bg-site-card" />
        <div className="h-36 animate-pulse rounded-xl border border-site-border bg-site-card" />
        <div className="h-44 animate-pulse rounded-xl border border-site-border bg-site-card" />
      </div>
    </main>
  );
}
