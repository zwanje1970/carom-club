import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getSiteCommunityConfig,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../../lib/server/dev-store";
import SiteShellFrame from "../../../components/SiteShellFrame";
import CommunityPostWriteForm from "./CommunityPostWriteForm";

type Props = {
  params: Promise<{ boardType: string }>;
};

export default async function SiteCommunityWritePage({ params }: Props) {
  const { boardType: raw } = await params;
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/site/community/${boardType}/write`)}`);
  }

  return (
    <SiteShellFrame brandTitle={`글쓰기 · ${board.label}`}>
      <section className="site-site-gray-main v3-stack ui-community-post-detail-page">
        <CommunityPostWriteForm boardType={boardType} />
        <div className="ui-community-post-detail-foot">
          <Link className="secondary-button ui-community-post-detail-foot-secondary" href={`/site/community/${boardType}`}>
            목록
          </Link>
        </div>
      </section>
    </SiteShellFrame>
  );
}
