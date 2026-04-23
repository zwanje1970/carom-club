"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CommentItem = {
  id: string;
  authorUserId: string;
  authorNickname: string;
  content: string;
  createdAt: string;
};

type Props = {
  boardType: string;
  postId: string;
  isLoggedIn: boolean;
  currentUserId: string | null;
};

function formatCommentDate(iso: string): string {
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

export default function CommunityPostCommentsSection({ boardType, postId, isLoggedIn, currentUserId }: Props) {
  const loginNext = `/site/community/${boardType}/${postId}`;
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const q = encodeURIComponent(postId);
    const response = await fetch(`/api/site/community/comments?postId=${q}`);
    if (!response.ok) {
      setItems([]);
      return;
    }
    const data = (await response.json()) as { items?: CommentItem[] };
    setItems(Array.isArray(data.items) ? data.items : []);
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleSubmit() {
    if (!isLoggedIn || submitting) return;
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/site/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: text }),
      });
      if (!response.ok) return;
      setContent("");
      await load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("삭제할까요?")) return;
    try {
      const response = await fetch(`/api/site/community/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      await load();
    } catch {
      // ignore
    }
  }

  return (
    <section className="card-clean ui-community-comments v3-stack">
      <h2 className="ui-community-comments-heading">댓글</h2>
      {loading ? <p className="v3-muted ui-community-comments-loading">불러오는 중...</p> : null}
      {!loading ? (
        <ul className="ui-community-comment-list">
          {items.map((c) => (
            <li key={c.id} className="ui-community-comment-item">
              <div className="ui-community-comment-author">{c.authorNickname}</div>
              <div className="ui-community-comment-meta v3-muted">{formatCommentDate(c.createdAt)}</div>
              <div className="ui-community-comment-body">{c.content}</div>
              {currentUserId && c.authorUserId === currentUserId ? (
                <button type="button" className="secondary-button ui-community-post-action-tight" onClick={() => handleDelete(c.id)}>
                  삭제
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="ui-community-comments-empty v3-muted" role="status">
          댓글이 없습니다.
        </p>
      ) : null}

      {isLoggedIn ? (
        <div className="ui-community-comment-compose v3-stack">
          <textarea
            className="ui-community-form-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="댓글을 입력하세요"
          />
          <button type="button" className="primary-button ui-community-post-action-submit" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      ) : (
        <p className="ui-community-comments-login-hint v3-muted">
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>로그인</Link> 후 댓글을 남길 수 있습니다.
        </p>
      )}
    </section>
  );
}
