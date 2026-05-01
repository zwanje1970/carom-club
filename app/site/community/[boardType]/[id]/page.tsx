import { cookies, headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../../../../lib/is-carom-club-mobile-app-shell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getCommunityPostLongEdgePx } from "../../../../../lib/community-post-content-images";
import { parseCommunityPostBodyForPublicSiteDetail } from "../../../../../lib/server/community-post-detail-site-images";
import { parseCommunityBoardTypeParam } from "../../../../../lib/community-board-params";
import {
  getCommunityPostById,
  getSiteCommunityConfig,
  getUserById,
  incrementCommunityPostViewCount,
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

  const existing = await getCommunityPostById(postId);
  if (!existing || existing.boardType !== boardType) notFound();

  await incrementCommunityPostViewCount(postId);
  const post = await getCommunityPostById(postId);
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
          <h1 className="ui-community-post-detail-title">{post.title}</h1>
          <p className="ui-community-post-detail-pill-row">
            <span className={boardPillClass(boardType)}>{boardPillLabel}</span>
          </p>
          <p className="ui-community-post-detail-meta v3-muted">
            {post.authorNickname} · {formatDetailDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글{" "}
            {post.commentCount}
          </p>
          <div className="ui-community-post-body">
            {segments.map((seg, i) =>
              seg.kind === "text" ? (
                <span key={i} className="ui-community-post-body-text">
                  {seg.value}
                </span>
              ) : seg.url ? (
                <span key={i} className="ui-community-post-body-figure">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="ui-community-post-inline-img"
                    src={seg.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      maxWidth: `min(100%, ${getCommunityPostLongEdgePx(seg.sizeLevel)}px)`,
                      maxHeight: `min(70vh, ${getCommunityPostLongEdgePx(seg.sizeLevel)}px)`,
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      margin: 0,
                    }}
                  />
                </span>
              ) : null
            )}
            {tailImages.map((item, idx) =>
              item.url ? (
                <span key={`tail-${idx}-${item.url}`} className="ui-community-post-body-figure">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="ui-community-post-inline-img"
                    src={item.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      maxWidth: `min(100%, ${getCommunityPostLongEdgePx(item.sizeLevel)}px)`,
                      maxHeight: `min(70vh, ${getCommunityPostLongEdgePx(item.sizeLevel)}px)`,
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      margin: 0,
                    }}
                  />
                </span>
              ) : null
            )}
          </div>
        </article>
        <CommunityPostDetailActions
          canManageAuthor={canManageAuthor}
          canDeletePost={canDeletePost}
          postId={postId}
          boardType={boardType}
        />
        <CommunityPostCommentsSection
          boardType={boardType}
          postId={postId}
          isLoggedIn={Boolean(session)}
          currentUserId={currentUserId}
        />
        <div className="ui-community-post-detail-foot">
          <Link
            prefetch={false}
            className="primary-button ui-community-post-detail-foot-primary"
            href={`/site/community/${boardType}`}
          >
            목록으로
          </Link>
        </div>
      </section>
    </SiteShellFrame>
  );
}
