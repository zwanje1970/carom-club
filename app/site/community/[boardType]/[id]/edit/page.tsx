import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  getCommunityPostById,
  getSiteCommunityConfig,
  getUserById,
  isCommunityPostAuthor,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../../../lib/server/dev-store";
import CommunityPostEditForm from "./CommunityPostEditForm";

type Props = {
  params: Promise<{ boardType: string; id: string }>;
};

export default async function SiteCommunityPostEditPage({ params }: Props) {
  const { boardType: rawBoard, id: rawId } = await params;
  const boardType = parseCommunityBoardTypeParam(rawBoard);
  const postId = typeof rawId === "string" ? rawId.trim() : "";
  if (!boardType || !postId) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/site/community/${boardType}/${postId}/edit`)}`);
  }

  const user = await getUserById(session.userId);
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/site/community/${boardType}/${postId}/edit`)}`);
  }

  const post = await getCommunityPostById(postId);
  if (!post || post.boardType !== boardType) notFound();

  const allowed = await isCommunityPostAuthor(post.authorUserId, user.id);
  if (!allowed) {
    redirect(`/site/community/${boardType}`);
  }

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1" style={{ fontSize: "1.4rem" }}>
        수정 · {board.label}
      </h1>
      <CommunityPostEditForm
        boardType={boardType}
        postId={postId}
        initialTitle={post.title}
        initialContent={post.content}
        initialImageUrls={post.imageUrls}
        initialImageSizeLevels={post.imageSizeLevels}
      />
      <div className="v3-row">
        <Link className="v3-btn" href={`/site/community/${boardType}/${postId}`}>
          취소
        </Link>
      </div>
    </main>
  );
}
