import { cookies, headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../../../../lib/is-carom-club-mobile-app-shell";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { parseCommunityPostBodyForPublicSiteDetail } from "../../../../../lib/server/community-post-detail-site-images";
import { getCommunityPostWithIncrementView } from "../../../../../lib/server/platform-backing-store";
import { parseCommunityBoardTypeParam } from "../../../../../lib/community-board-params";
import {
  getSiteCommunityConfig,
  getUserById,
  isCommunityPostAuthor,
} from "../../../../../lib/surface-read";
import type { SiteCommunityBoardKey } from "../../../../../lib/types/entities";
import SiteShellFrame from "../../../components/SiteShellFrame";
import {
  COMMUNITY_ROOM_PREFIX_SHORT,
  communityTabLabelForBoard,
  isPrimaryTabKey,
} from "../../community-tab-config";
import CommunityPostCommentsSection from "./CommunityPostCommentsSection";
import CommunityPostDetailBody from "./CommunityPostDetailBody";
import CommunityPostDetailActions from "./CommunityPostDetailActions";

function boardPillClass(boardType: SiteCommunityBoardKey): string {
  const base = "ui-community-board-pill";
  if (boardType === "free") return `${base} ${base}--free`;
  if (boardType === "qna") return `${base} ${base}--qna`;
  if (boardType === "reviews") return `${base} ${base}--reviews`;
  return `${base} ${base}--muted`;
}

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
  params: Promise<{ boardType: string; id: string }>;
};

export default async function SiteCommunityPostDetailPage({ params }: Props) {
  const { boardType: rawBoard, id: rawId } = await params;
  const boardType = parseCommunityBoardTypeParam(rawBoard);
  const postId = typeof rawId === "string" ? rawId.trim() : "";
  if (!boardType || !postId) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const post = await getCommunityPostWithIncrementView(postId, { expectedBoardType: boardType });
  if (!post) notFound();

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

  const boardPillLabel = isPrimaryTabKey(boardType)
    ? COMMUNITY_ROOM_PREFIX_SHORT[boardType]
    : communityTabLabelForBoard(boardType, config).trim() || boardType;

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">{post.title}</span>}>
      <section className="site-site-gray-main v3-stack ui-community-post-detail-page">
        <article className="ui-community-post-detail-article v3-stack">
          <div className="ui-community-post-detail-title-row">
            <h1 className="ui-community-post-detail-title">{post.title}</h1>
            <CommunityPostDetailActions
              canManageAuthor={canManageAuthor}
              canDeletePost={canDeletePost}
              postId={postId}
              boardType={boardType}
            />
          </div>
          <p className="ui-community-post-detail-pill-row">
            <span className={boardPillClass(boardType)}>{boardPillLabel}</span>
          </p>
          <p className="ui-community-post-detail-meta v3-muted">
            {post.authorNickname} · {formatDetailDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글{" "}
            {post.commentCount}
          </p>
          <CommunityPostDetailBody
            segments={segments}
            tailImages={tailImages}
          />
        </article>
        <CommunityPostCommentsSection
          boardType={boardType}
          postId={postId}
          isLoggedIn={Boolean(session)}
          currentUserId={currentUserId}
        />
      </section>
    </SiteShellFrame>
  );
}
