import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { isCaromClubMobileAppShell } from "../../../../../lib/is-carom-club-mobile-app-shell";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { parseCommunityPostBodyForPublicSiteDetail } from "../../../../../lib/server/community-post-detail-site-images";
import {
  getCommunityPostDetailForPublicSitePage,
  incrementCommunityPostViewCountLight,
} from "../../../../../lib/server/platform-backing-store";
import {
  getSiteCommunityConfig,
  getUserById,
  isCommunityPostAuthor,
} from "../../../../../lib/surface-read";
import type { SiteCommunityBoardKey } from "../../../../../lib/types/entities";
import { communityBoardListHref } from "../../community-tab-config";
import CommunityListBackLink from "../../CommunityListBackLink";
import CommunityPostCommentsSection from "./CommunityPostCommentsSection";
import CommunityPostDetailBody from "./CommunityPostDetailBody";
import CommunityPostDetailActions from "./CommunityPostDetailActions";

function formatDetailDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Props = {
  boardType: SiteCommunityBoardKey;
  postId: string;
};

export default async function SiteCommunityPostDetailPageContent({ boardType, postId }: Props) {
  const config = await getSiteCommunityConfig();
  const board = config[boardType];
  if (!board.visible) notFound();

  const post = await getCommunityPostDetailForPublicSitePage(postId, { expectedBoardType: boardType });
  if (!post) notFound();

  after(() => {
    void incrementCommunityPostViewCountLight(postId);
  });

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  let canManageAuthor = false;
  let canPlatformDelete = false;
  let currentUserId: string | null = null;
  if (session) {
    const user = await getUserById(session.userId);
    if (user) {
      currentUserId = user.id;
      canManageAuthor = await isCommunityPostAuthor(post.authorUserId, user.id);
      const headerList = await headers();
      canPlatformDelete = user.role === "PLATFORM" && !isCaromClubMobileAppShell(headerList);
    }
  }
  const canDeletePost = canManageAuthor || canPlatformDelete;

  const { segments, tailImages } = await parseCommunityPostBodyForPublicSiteDetail(
    post.content,
    post.imageUrls,
    post.imageSizeLevels,
  );

  return (
    <>
      <article className="ui-community-post-detail-article v3-stack">
        <div className="ui-community-post-detail-heading-row">
          <h1 className="ui-community-post-detail-title">{post.title}</h1>
          <CommunityPostDetailActions
            canManageAuthor={canManageAuthor}
            canDeletePost={canDeletePost}
            postId={postId}
            boardType={boardType}
            className="ui-community-post-detail-actions ui-community-post-detail-actions--in-article"
          />
        </div>
        <p className="ui-community-post-detail-meta">
          <span className="ui-community-post-detail-author">{post.authorNickname}</span>
          <span className="ui-community-post-detail-meta-plain">
            {" "}
            · {formatDetailDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글 {post.commentCount}
          </span>
        </p>
        <CommunityPostDetailBody segments={segments} tailImages={tailImages} />
      </article>
      <CommunityPostCommentsSection
        boardType={boardType}
        postId={postId}
        isLoggedIn={Boolean(session)}
        currentUserId={currentUserId}
      />
      <div style={{ marginTop: "0.9rem" }}>
        <CommunityListBackLink className="secondary-button" href={communityBoardListHref(boardType)}>
          목록으로
        </CommunityListBackLink>
      </div>
    </>
  );
}
