import { revalidateTag } from "next/cache";
import { COMMUNITY_HOME_CACHE_TAG } from "@/lib/community-home-data";

/** 글 작성·수정·삭제 후 커뮤니티 홈 캐시 무효화 */
export function revalidateCommunityHome(): void {
  revalidateTag(COMMUNITY_HOME_CACHE_TAG);
}
