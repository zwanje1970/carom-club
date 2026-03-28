import { Suspense } from "react";
import { redirect } from "next/navigation";
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
  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : "all";
  if (rawCategory === "trouble") {
    redirect("/community/nangu");
  }
  const category =
    rawCategory === "all" ||
    rawCategory === "free" ||
    rawCategory === "qna" ||
    rawCategory === "notice"
      ? rawCategory
      : "all";

  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityHomeInner category={category} />
    </Suspense>
  );
}
