"use client";

import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

/**
 * 대회 목록 상단 제목·부제(TournamentsChrome과 동일). 레거시 페이지는 래퍼 포함, 슬롯 내부는 `wrapContainer={false}`.
 */
export function TournamentsPageChromeTitles({
  copy,
  wrapContainer = true,
}: {
  copy: Record<string, string>;
  wrapContainer?: boolean;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  const inner = (
    <>
      <h1 className="text-2xl font-bold text-site-text md:block hidden">{getCopyValue(c, "site.tournaments.title")}</h1>
      <p className="mt-2 text-gray-600 md:block hidden">{getCopyValue(c, "site.tournaments.subtitle")}</p>
    </>
  );
  if (!wrapContainer) return inner;
  return (
    <PageContentContainer maxWidthClass="max-w-5xl" className="py-6">
      {inner}
    </PageContentContainer>
  );
}
