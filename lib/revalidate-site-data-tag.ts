import { revalidateTag } from "next/cache";

/** Next 16: `revalidateTag` 두 번째 인자 필수 — 관리자 저장 직후 다음 요청에 신선 데이터 */
export function revalidateSiteDataTag(tag: string): void {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch {
    /* Next 요청 컨텍스트 밖(스크립트 등) */
  }
}
