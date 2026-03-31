import { PageContentContainer } from "@/components/layout/PageContentContainer";

/** 대회 목록: 상단 제목만 짧게 — 카드 그리드 스켈레톤은 제거(본문이 RSC로 곧 채워짐) */
export default function TournamentsLoading() {
  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <PageContentContainer maxWidthClass="max-w-5xl" className="py-12">
        <div className="h-8 w-48 max-w-full animate-pulse rounded bg-site-border" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-site-border" />
        <div className="mt-8 h-10 w-full max-w-md animate-pulse rounded bg-site-border" />
      </PageContentContainer>
    </main>
  );
}
