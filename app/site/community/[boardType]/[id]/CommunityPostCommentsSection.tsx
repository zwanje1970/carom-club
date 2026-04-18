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
    <section className="v3-box v3-stack" style={{ marginTop: "1rem" }}>
      <h2 className="v3-h2" style={{ fontSize: "1.05rem", margin: 0 }}>
        댓글
      </h2>
      {loading ? <p className="v3-muted">불러오는 중...</p> : null}
      {!loading ? (
        <ul className="v3-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((c) => (
            <li
              key={c.id}
              style={{
                padding: "0.65rem 0",
                borderBottom: "1px solid var(--v3-border, #e8e8e8)",
                fontSize: "0.9rem",
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.authorNickname}</div>
              <div className="v3-muted" style={{ fontSize: "0.82rem" }}>
                {formatCommentDate(c.createdAt)}
              </div>
              <div style={{ marginTop: "0.35rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.content}</div>
              {currentUserId && c.authorUserId === currentUserId ? (
                <button
                  type="button"
                  className="v3-btn"
                  onClick={() => handleDelete(c.id)}
                  style={{ marginTop: "0.4rem", padding: "0.25rem 0.5rem", fontSize: "0.82rem" }}
                >
                  삭제
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && items.length === 0 ? <p className="v3-muted">댓글이 없습니다.</p> : null}

      {isLoggedIn ? (
        <div className="v3-stack" style={{ marginTop: "0.75rem" }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="댓글"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem", resize: "vertical" }}
          />
          <button
            type="button"
            className="v3-btn"
            disabled={submitting}
            onClick={handleSubmit}
            style={{ padding: "0.55rem 1rem", alignSelf: "flex-start" }}
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      ) : (
        <p className="v3-muted" style={{ marginTop: "0.75rem" }}>
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>로그인</Link> 후 댓글을 남길 수 있습니다.
        </p>
      )}
    </section>
  );
}
