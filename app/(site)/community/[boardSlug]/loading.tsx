import { PageContentContainer } from "@/components/layout/PageContentContainer";

export default function CommunityBoardSlugLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text pb-24">
      <PageContentContainer className="py-5">
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded bg-site-border" aria-hidden />
          <div className="h-6 w-40 animate-pulse rounded bg-site-border" aria-hidden />
          <div className="h-9 w-24 animate-pulse rounded bg-site-border" aria-hidden />
        </div>

        <div className="mt-4 space-y-3">
          <div className="h-9 w-full animate-pulse rounded bg-site-border" aria-hidden />
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i} className="py-3.5 px-1">
                <div className="h-4 w-full max-w-lg animate-pulse rounded bg-site-border" />
                <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-site-border" />
              </li>
            ))}
          </ul>
        </div>
      </PageContentContainer>
    </main>
  );
}
