import { Suspense } from "react";
import { TournamentsChrome } from "./TournamentsChrome";
import { TournamentsListBlock } from "./TournamentsListBlock";
import { TournamentsListSkeleton } from "./TournamentsListSkeleton";

export const revalidate = 60;

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <TournamentsChrome />
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <TournamentsListSkeleton />
          </div>
        }
      >
        <TournamentsListBlock searchParams={sp} />
      </Suspense>
    </main>
  );
}
