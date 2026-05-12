"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const COMMUNITY_COMMENT_MAX_LENGTH = 500;

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

function sliceCommunityCommentInput(value: string): string {
  if (value.length <= COMMUNITY_COMMENT_MAX_LENGTH) return value;
  return value.slice(0, COMMUNITY_COMMENT_MAX_LENGTH);
}

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
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    const el = commentTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight);
    const lineHeight = Number.isFinite(line) && line > 0 ? line : 22;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const minH = Math.ceil(lineHeight * 1 + pad);
    const maxH = Math.ceil(lineHeight * 4 + pad);
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [content]);

  function cancelEdit() {
    setEditingCommentId(null);
    setContent("");
  }

  function startEdit(c: CommentItem) {
    setEditingCommentId(c.id);
    setContent(sliceCommunityCommentInput(c.content));
  }

  function handleCommentPaste(ev: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = ev.clipboardData.getData("text/plain");
    if (!pasted) return;
    ev.preventDefault();
    const ta = ev.currentTarget;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const merged = content.slice(0, start) + pasted + content.slice(end);
    const next = sliceCommunityCommentInput(merged);
    setContent(next);
    const caret = Math.min(start + pasted.length, next.length);
    requestAnimationFrame(() => {
      try {
        ta.selectionStart = ta.selectionEnd = caret;
      } catch {
        /* ignore */
      }
    });
  }

  async function handleSubmit() {
    if (!isLoggedIn || submitting) return;
    const text = sliceCommunityCommentInput(content).trim();
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

  const contentLen = content.length;
  const canSubmit = Boolean(content.trim()) && !submitting;

  return (
    <section className="ui-community-comments v3-stack">
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
          <div className="ui-community-comment-compose-block">
            <div className="ui-community-comment-compose-inline">
              {editingCommentId ? (
                <button type="button" className="ui-community-comment-compose-cancel-inline" onClick={cancelEdit}>
                  취소
                </button>
              ) : null}
              <textarea
                ref={commentTextareaRef}
                className="ui-community-form-textarea ui-community-comment-textarea-inline"
                value={content}
                onChange={(e) => setContent(sliceCommunityCommentInput(e.target.value))}
                onPaste={handleCommentPaste}
                rows={1}
                maxLength={COMMUNITY_COMMENT_MAX_LENGTH}
                placeholder="댓글을 입력하세요"
                spellCheck={false}
              />
              <button
                type="button"
                className="primary-button ui-community-comment-submit-inline"
                disabled={!canSubmit}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {submitting ? (editingCommentId ? "수정 중..." : "등록 중...") : editingCommentId ? "수정완료" : "등록"}
              </button>
            </div>
            <div className="ui-community-comment-compose-meter" aria-live="polite">
              {contentLen} / {COMMUNITY_COMMENT_MAX_LENGTH}
            </div>
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
