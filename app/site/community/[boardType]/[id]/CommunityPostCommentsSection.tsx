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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

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

  function cancelEdit() {
    setEditingCommentId(null);
    setContent("");
  }

  function startEdit(c: CommentItem) {
    setEditingCommentId(c.id);
    setContent(c.content);
  }

  async function handleSubmit() {
    if (!isLoggedIn || submitting) return;
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      if (editingCommentId) {
        const response = await fetch(`/api/site/community/comments/${encodeURIComponent(editingCommentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!response.ok) return;
        cancelEdit();
        await load();
      } else {
        const response = await fetch("/api/site/community/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, content: text }),
        });
        if (!response.ok) return;
        setContent("");
        await load();
      }
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
      if (editingCommentId === commentId) cancelEdit();
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
          {items.map((c) => {
            const canManage = Boolean(currentUserId && c.authorUserId === currentUserId);
            return (
              <li key={c.id} className="ui-community-comment-item">
                <div className="ui-community-comment-head">
                  <div className="ui-community-comment-head-main">
                    <div className="ui-community-comment-author">{c.authorNickname}</div>
                    <div className="ui-community-comment-meta v3-muted">{formatCommentDate(c.createdAt)}</div>
                  </div>
                  {canManage ? (
                    <div className="ui-community-comment-actions">
                      <button type="button" className="ui-community-comment-text-action" onClick={() => startEdit(c)}>
                        수정
                      </button>
                      <span className="ui-community-comment-action-sep" aria-hidden>
                        ·
                      </span>
                      <button type="button" className="ui-community-comment-text-action" onClick={() => handleDelete(c.id)}>
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="ui-community-comment-body">{c.content}</div>
              </li>
            );
          })}
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
          <div className="ui-community-comment-compose-row">
            {editingCommentId ? (
              <button type="button" className="ui-community-comment-text-action ui-community-comment-compose-cancel" onClick={cancelEdit}>
                취소
              </button>
            ) : null}
            <button type="button" className="primary-button ui-community-post-action-submit" disabled={submitting} onClick={handleSubmit}>
              {submitting ? (editingCommentId ? "수정 중..." : "등록 중...") : editingCommentId ? "수정완료" : "등록"}
            </button>
          </div>
        </div>
      ) : (
        <p className="ui-community-comments-login-hint v3-muted">
          <Link prefetch={false} href={`/login?next=${encodeURIComponent(loginNext)}`}>
            로그인
          </Link>{" "}
          후 댓글을 남길 수 있습니다.
        </p>
      )}
    </section>
  );
}
