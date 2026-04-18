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
    <div className="v3-row" style={{ marginBottom: "0.75rem" }}>
      <Link className="v3-btn" href={`/site/community/${boardType}/${postId}/edit`} style={{ padding: "0.45rem 0.8rem" }}>
        수정
      </Link>
      <button type="button" className="v3-btn" onClick={handleDelete} style={{ padding: "0.45rem 0.8rem" }}>
        삭제
      </button>
    </div>
  );
}
