import { Suspense } from "react";
import CommunityLoading from "./loading";
import { CommunityHomeInner } from "./CommunityHomeInner";

/**
 * 동기 셸 + Suspense로 스트리밍: HTML이 즉시 내려가고 loading 폴백이 먼저 보임.
 * 데이터는 CommunityHomeInner에서 캐시·병렬 로드.
 */
export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityHomeInner />
    </Suspense>
  );
}
