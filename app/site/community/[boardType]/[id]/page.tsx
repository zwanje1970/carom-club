import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getCommunityPostLongEdgePx,
  parseCommunityPostBodySegmentsWithSizes,
} from "../../../../../lib/community-post-content-images";
import {
  getCommunityPostById,
  getSiteCommunityConfig,
  getUserById,
  incrementCommunityPostViewCount,
  isCommunityPostAuthor,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../../lib/server/dev-store";
import SiteShellFrame from "../../../components/SiteShellFrame";
import CommunityPostCommentsSection from "./CommunityPostCommentsSection";
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
  let canManage = false;
  let currentUserId: string | null = null;
  if (session) {
    const user = await getUserById(session.userId);
    if (user) {
      currentUserId = user.id;
      canManage = await isCommunityPostAuthor(post.authorUserId, user.id);
    }
  }

  const { segments, tailImages } = parseCommunityPostBodySegmentsWithSizes(
    post.content,
    post.imageUrls,
    post.imageSizeLevels
  );

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">{post.title}</span>}>
      <section className="site-site-gray-main v3-stack">
      <CommunityPostDetailActions canManage={canManage} postId={postId} boardType={boardType} />
      <article className="v3-box v3-stack">
        <p className="v3-muted" style={{ fontSize: "0.88rem", margin: 0 }}>
          {post.authorNickname} · {formatDetailDateTime(post.createdAt)} · 조회 {post.viewCount}
        </p>
        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.95rem",
            lineHeight: 1.65,
            wordBreak: "break-word",
          }}
        >
          {segments.map((seg, i) =>
            seg.kind === "text" ? (
              <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                {seg.value}
              </span>
            ) : (
              <span
                key={i}
                style={{
                  display: "block",
                  margin: "0.35em 0",
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={seg.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{
                    maxWidth: getCommunityPostLongEdgePx(seg.sizeLevel),
                    maxHeight: getCommunityPostLongEdgePx(seg.sizeLevel),
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    margin: 0,
                  }}
                />
              </span>
            )
          )}
          {tailImages.map((item, idx) => (
            <span
              key={`tail-${idx}-${item.url}`}
              style={{
                display: "block",
                margin: "0.35em 0",
                lineHeight: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                loading="lazy"
                decoding="async"
                style={{
                  maxWidth: getCommunityPostLongEdgePx(item.sizeLevel),
                  maxHeight: getCommunityPostLongEdgePx(item.sizeLevel),
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  margin: 0,
                }}
              />
            </span>
          ))}
        </div>
      </article>
      <CommunityPostCommentsSection
        boardType={boardType}
        postId={postId}
        isLoggedIn={Boolean(session)}
        currentUserId={currentUserId}
      />
      <div className="v3-row">
        <Link className="v3-btn" href={`/site/community/${boardType}`}>
          목록으로
        </Link>
      </div>
      </section>
    </SiteShellFrame>
  );
}
