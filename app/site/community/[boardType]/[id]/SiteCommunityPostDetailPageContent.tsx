import { Suspense } from "react";
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
import {
  CommunityDetailSuspenseFallback,
  CommunityLoadDiagBodyReady,
  CommunityLoadDiagConfigComplete,
  CommunityLoadDiagPostComplete,
} from "./community-load-diag-client";

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

type ViewerContext = {
  isLoggedIn: boolean;
  currentUserId: string | null;
  canManageAuthor: boolean;
  canDeletePost: boolean;
};

async function loadViewerContext(postAuthorUserId: string): Promise<ViewerContext> {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return { isLoggedIn: false, currentUserId: null, canManageAuthor: false, canDeletePost: false };
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return { isLoggedIn: true, currentUserId: null, canManageAuthor: false, canDeletePost: false };
  }

  const [canManageAuthor, requestHeaders] = await Promise.all([
    isCommunityPostAuthor(postAuthorUserId, user.id),
    headers(),
  ]);
  const canPlatformDelete = user.role === "PLATFORM" && !isCaromClubMobileAppShell(requestHeaders);
  return {
    isLoggedIn: true,
    currentUserId: user.id,
    canManageAuthor,
    canDeletePost: canManageAuthor || canPlatformDelete,
  };
}

type PostBodyPayload = {
  content: string;
  imageUrls: string[];
  imageSizeLevels: number[];
};

async function CommunityPostDetailBodyAsync({ payload }: { payload: PostBodyPayload }) {
  const { segments, tailImages } = await parseCommunityPostBodyForPublicSiteDetail(
    payload.content,
    payload.imageUrls,
    payload.imageSizeLevels,
  );
  return (
    <>
      <CommunityPostDetailBody segments={segments} tailImages={tailImages} />
      <CommunityLoadDiagBodyReady />
    </>
  );
}

async function CommunityPostDetailActionsAsync({
  viewerContextPromise,
  postId,
  boardType,
}: {
  viewerContextPromise: Promise<ViewerContext>;
  postId: string;
  boardType: SiteCommunityBoardKey;
}) {
  const viewer = await viewerContextPromise;
  return (
    <CommunityPostDetailActions
      canManageAuthor={viewer.canManageAuthor}
      canDeletePost={viewer.canDeletePost}
      postId={postId}
      boardType={boardType}
      className="ui-community-post-detail-actions ui-community-post-detail-actions--in-article"
    />
  );
}

async function CommunityPostCommentsAsync({
  viewerContextPromise,
  boardType,
  postId,
}: {
  viewerContextPromise: Promise<ViewerContext>;
  boardType: SiteCommunityBoardKey;
  postId: string;
}) {
  const viewer = await viewerContextPromise;
  return (
    <CommunityPostCommentsSection
      boardType={boardType}
      postId={postId}
      isLoggedIn={viewer.isLoggedIn}
      currentUserId={viewer.currentUserId}
    />
  );
}

export default async function SiteCommunityPostDetailPageContent({ boardType, postId }: Props) {
  const contentConfigFetchStartMs = Date.now();
  const config = await getSiteCommunityConfig();
  const contentConfigFetchDurationMs = Date.now() - contentConfigFetchStartMs;
  const board = config[boardType];
  if (!board.visible) notFound();

  const postFetchStartMs = Date.now();
  const post = await getCommunityPostDetailForPublicSitePage(postId, { expectedBoardType: boardType });
  const postFetchDurationMs = Date.now() - postFetchStartMs;
  if (!post) notFound();

  after(() => {
    void incrementCommunityPostViewCountLight(postId);
  });

  const viewerContextPromise = loadViewerContext(post.authorUserId);
  const postBodyPayload: PostBodyPayload = {
    content: post.content,
    imageUrls: post.imageUrls,
    imageSizeLevels: post.imageSizeLevels,
  };

  return (
    <>
      <CommunityLoadDiagConfigComplete durationMs={contentConfigFetchDurationMs} />
      <CommunityLoadDiagPostComplete
        durationMs={postFetchDurationMs}
        titleLength={post.title.length}
        contentLength={post.content.length}
      />
      <article className="ui-community-post-detail-article v3-stack">
        <div className="ui-community-post-detail-heading-row">
          <h1 className="ui-community-post-detail-title">{post.title}</h1>
          <Suspense fallback={null}>
            <CommunityPostDetailActionsAsync
              viewerContextPromise={viewerContextPromise}
              postId={postId}
              boardType={boardType}
            />
          </Suspense>
        </div>
        <p className="ui-community-post-detail-meta">
          <span className="ui-community-post-detail-author">{post.authorNickname}</span>
          <span className="ui-community-post-detail-meta-plain">
            {" "}
            · {formatDetailDateTime(post.createdAt)} · 조회 {post.viewCount} · 댓글 {post.commentCount}
          </span>
        </p>
        <Suspense fallback={<CommunityDetailSuspenseFallback />}>
          <CommunityPostDetailBodyAsync payload={postBodyPayload} />
        </Suspense>
      </article>
      <Suspense fallback={<CommunityDetailSuspenseFallback />}>
        <CommunityPostCommentsAsync
          viewerContextPromise={viewerContextPromise}
          boardType={boardType}
          postId={postId}
        />
      </Suspense>
      <div style={{ marginTop: "0.9rem" }}>
        <CommunityListBackLink className="secondary-button" href={communityBoardListHref(boardType)}>
          목록으로
        </CommunityListBackLink>
      </div>
    </>
  );
}
