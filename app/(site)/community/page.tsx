import { Suspense } from "react";
import CommunityLoading from "./loading";
import { CommunityHomeInner } from "./CommunityHomeInner";

/**
 * 동기 셸 + Suspense로 스트리밍: HTML이 즉시 내려가고 loading 폴백이 먼저 보임.
 * 데이터는 CommunityHomeInner에서 캐시·병렬 로드.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  console.time("community_page_total");
  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : "all";
  const category =
    rawCategory === "all" ||
    rawCategory === "free" ||
    rawCategory === "qna" ||
    rawCategory === "notice"
      ? rawCategory
      : "all";
  console.timeEnd("community_page_total");

  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityHomeInner category={category} />
    </Suspense>
  );
}
