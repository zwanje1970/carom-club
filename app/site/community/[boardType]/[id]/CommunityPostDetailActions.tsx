"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  canManage: boolean;
  postId: string;
  boardType: string;
};

export default function CommunityPostDetailActions({ canManage, postId, boardType }: Props) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("삭제할까요?")) return;
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

  if (!canManage) return null;

  return (
    <div className="ui-community-post-manage-actions">
      <Link className="secondary-button ui-community-post-action-tight" href={`/site/community/${boardType}/${postId}/edit`}>
        수정
      </Link>
      <button type="button" className="secondary-button ui-community-post-action-tight ui-community-post-action-danger" onClick={handleDelete}>
        삭제
      </button>
    </div>
  );
}
