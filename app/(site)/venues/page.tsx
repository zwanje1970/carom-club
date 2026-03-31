import { Suspense } from "react";
import { PageContentContainer } from "@/components/layout/PageContentContainer";
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
          <PageContentContainer maxWidthClass="max-w-5xl">
            <VenuesListSkeleton />
          </PageContentContainer>
        }
      >
        <VenuesListBlock />
      </Suspense>
    </main>
  );
}
