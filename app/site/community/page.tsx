import { redirect } from "next/navigation";
import { COMMUNITY_PRIMARY_BOARD_KEYS, getSiteCommunityConfig } from "../../../lib/server/dev-store";

/** `/site/community` → 기본 게시판 목록(첫 번째로 켜진 primary 탭) */
export default async function SiteCommunityPage() {
  let config = await getSiteCommunityConfig().catch(() => null);
  if (!config) {
    redirect("/site/community/free");
  }
  const first = COMMUNITY_PRIMARY_BOARD_KEYS.find((k) => config[k].visible);
  redirect(first ? `/site/community/${first}` : "/site");
}
