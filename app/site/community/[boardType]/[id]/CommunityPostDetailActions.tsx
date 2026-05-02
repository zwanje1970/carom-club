"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

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
    <div className="ui-community-post-title-actions" ref={rootRef}>
      <button
        type="button"
        className="ui-community-post-more-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="게시글 메뉴"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div className="ui-community-post-more-menu" role="menu">
          {canManageAuthor ? (
            <Link
              prefetch={false}
              role="menuitem"
              className="ui-community-post-more-item"
              href={`/site/community/${boardType}/${postId}/edit`}
              onClick={() => setOpen(false)}
            >
              수정
            </Link>
          ) : null}
          {canDeletePost ? (
            <button
              type="button"
              role="menuitem"
              className="ui-community-post-more-item ui-community-post-more-item--danger"
              onClick={() => {
                setOpen(false);
                void handleDelete();
              }}
            >
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
