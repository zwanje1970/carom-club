import { Suspense } from "react";
import { VenuesChrome } from "./VenuesChrome";
import { VenuesListBlock } from "./VenuesListBlock";
import { VenuesListSkeleton } from "./VenuesListSkeleton";

export const revalidate = 60;

export default function VenuesPage() {
  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <VenuesChrome />
      <Suspense
        fallback={
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <VenuesListSkeleton />
          </div>
        }
      >
        <VenuesListBlock />
      </Suspense>
    </main>
  );
}
