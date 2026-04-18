import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSiteCommunityConfig,
  listCommunityPosts,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../lib/server/dev-store";
import CommunityBoardPostList from "../CommunityBoardPostList";
import SiteShellFrame from "../../components/SiteShellFrame";

type Props = {
  params: Promise<{ boardType: string }>;
};

export default async function SiteCommunityBoardListPage({ params }: Props) {
  const { boardType: raw } = await params;
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const items = await listCommunityPosts(boardType);

  const writeHref = `/site/community/${boardType}/write`;

  return (
    <SiteShellFrame brandTitle={board.label}>
      <section className="site-site-gray-main v3-stack">
        <CommunityBoardPostList boardType={boardType} items={items} />
        <Link href={writeHref} className="community-write-fab" aria-label="글쓰기">
          <span aria-hidden>+</span>
        </Link>
      </section>
    </SiteShellFrame>
  );
}
