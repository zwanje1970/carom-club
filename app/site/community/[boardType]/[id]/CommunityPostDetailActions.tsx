"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const SOFT_DELETE_CONFIRM =
  "삭제하면 백업함으로 이동하며 복구할 수 있습니다.";

type Props = {
  /** 작성자 본인 — 수정 */
  canManageAuthor: boolean;
  /** 작성자 또는 플랫폼 관리자 — 삭제 */
  canDeletePost: boolean;
  postId: string;
  boardType: string;
};

export default function CommunityPostDetailActions({
  canManageAuthor,
  canDeletePost,
  postId,
  boardType,
}: Props) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(SOFT_DELETE_CONFIRM)) return;
    try {
      const response = await fetch(`/api/site/community/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      router.push(`/site/community/${boardType}`);
    } catch {
      // ignore
    }
  }

  if (!canManageAuthor && !canDeletePost) return null;

  return (
    <div className="ui-community-post-title-actions ui-community-post-title-actions--inline">
      {canManageAuthor ? (
        <Link
          prefetch={false}
          className="ui-community-comment-text-action"
          href={`/site/community/${boardType}/${postId}/edit`}
        >
          수정
        </Link>
      ) : null}
      {canManageAuthor && canDeletePost ? (
        <span className="ui-community-comment-action-sep" aria-hidden>
          ·
        </span>
      ) : null}
      {canDeletePost ? (
        <button
          type="button"
          className="ui-community-comment-text-action"
          onClick={() => {
            void handleDelete();
          }}
        >
          삭제
        </button>
      ) : null}
    </div>
  );
}
