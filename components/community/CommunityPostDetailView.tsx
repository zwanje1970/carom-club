"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const VIEWER_KEY_STORAGE = "community_viewer_key";

function CommentItem({
  comment,
  onLike,
  onDelete,
  onReply,
  onReport,
  depth = 0,
}: {
  comment: Comment;
  onLike: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string) => void;
  onReport: (commentId: string) => void;
  depth?: number;
}) {
  return (
    <li id={`comment-${comment.id}`} className={depth > 0 ? "ml-4 pl-3 border-l-2 border-gray-200 dark:border-slate-600" : ""}>
      <div className="rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-3">
        <p className="text-sm font-medium">{comment.authorName}</p>
        {comment.isHidden ? (
          <p className="mt-1 text-gray-500 dark:text-gray-400 italic">관리자에 의해 숨김 처리된 내용입니다.</p>
        ) : (
          <p className="mt-1 text-site-text whitespace-pre-wrap">{comment.content}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
          <span>{new Date(comment.createdAt).toLocaleString("ko-KR")}</span>
          {!comment.isHidden && (
            <>
              <button type="button" onClick={() => onLike(comment.id)} className={comment.liked ? "text-site-primary font-medium" : ""}>
                추천 {comment.likeCount}
              </button>
              <button type="button" onClick={() => onReply(comment.id)} className="text-site-primary">
                답글
              </button>
              {comment.isAuthor && (
                <button type="button" onClick={() => onDelete(comment.id)} className="text-red-600">삭제</button>
              )}
              <button type="button" onClick={() => onReport(comment.id)} className="text-gray-400">신고</button>
            </>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              onLike={onLike}
              onDelete={onDelete}
              onReply={onReply}
              onReport={onReport}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function getOrCreateViewerKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(VIEWER_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VIEWER_KEY_STORAGE, key);
    document.cookie = `${VIEWER_KEY_STORAGE}=${key};path=/;max-age=31536000`;
  }
  return key;
}

export type Comment = {
  id: string;
  parentId?: string | null;
  authorName: string;
  content: string;
  likeCount: number;
  createdAt: string;
  isAuthor: boolean;
  liked: boolean;
  isHidden?: boolean;
  replies?: Comment[];
};

export type CommunityPostDetailViewLinkOverrides = {
  listHref: string;
  editHref: string;
  deleteRedirect: string;
};

export function CommunityPostDetailView({
  postId,
  linkOverrides,
}: {
  postId: string;
  linkOverrides?: CommunityPostDetailViewLinkOverrides;
}) {
  const router = useRouter();
  const [post, setPost] = useState<{
    id: string;
    boardSlug: string;
    boardName: string;
    authorName: string;
    title: string;
    content: string;
    imageUrls: string[];
    viewCount: number;
    likeCount: number;
    commentCount: number;
    createdAt: string;
    isAuthor: boolean;
    canEdit: boolean;
    liked: boolean;
    bookmarked: boolean;
    isHidden?: boolean;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState<string>("OTHER");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const listHref = linkOverrides?.listHref ?? (post ? `/community/boards/${post.boardSlug}` : "/community");
  const editHref = linkOverrides?.editHref ?? `/community/posts/${postId}/edit`;
  const deleteRedirect = linkOverrides?.deleteRedirect ?? (post ? `/community/boards/${post.boardSlug}` : "/community");

  const REPORT_REASONS: { value: string; label: string }[] = [
    { value: "PROFANITY", label: "욕설/비방" },
    { value: "AD_SPAM", label: "광고/도배" },
    { value: "INAPPROPRIATE", label: "음란/부적절" },
    { value: "MISINFO", label: "허위 정보" },
    { value: "CONFLICT", label: "분쟁 유발" },
    { value: "OTHER", label: "기타" },
  ];

  const loadPost = useCallback(() => {
    fetch(`/api/community/posts/${postId}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("글을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        setPost(data);
        if (!data.isHidden) {
          const viewerKey = getOrCreateViewerKey();
          fetch(`/api/community/posts/${postId}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ viewerKey }),
          })
            .then((r) => r.json())
            .then((v) => { if (v.counted && v.viewCount != null) setPost((p) => (p ? { ...p, viewCount: v.viewCount } : null)); })
            .catch(() => {});
        }
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [postId]);

  const loadComments = useCallback(() => {
    fetch(`/api/community/posts/${postId}/comments`, { credentials: "include" })
      .then((res) => res.json())
      .then(setComments)
      .catch(() => setComments([]));
  }, [postId]);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [loadPost, loadComments]);

  const handleLike = async () => {
    if (likeLoading || !post) return;
    setLikeLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) setPost((p) => (p ? { ...p, liked: data.liked, likeCount: p.likeCount + (data.liked ? 1 : -1) } : null));
    } finally {
      setLikeLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (bookmarkLoading || !post) return;
    setBookmarkLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/bookmark`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok) setPost((p) => (p ? { ...p, bookmarked: data.bookmarked } : null));
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: commentText.trim(), parentId: replyToId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "댓글 등록 실패");
      const addToTree = (list: Comment[], item: Comment, parentId: string | null): Comment[] => {
        if ((item.parentId ?? null) === parentId) {
          return [...list, { ...item, replies: [] }];
        }
        return list.map((c) => ({
          ...c,
          replies: c.replies ? addToTree(c.replies, item, c.id) : c.replies,
        }));
      };
      setComments((prev) => addToTree(prev, data, replyToId));
      setCommentText("");
      setReplyToId(null);
      if (post) setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : null));
    } finally {
      setSubmittingComment(false);
    }
  };

  const updateCommentInTree = (list: Comment[], commentId: string, upd: Partial<Comment>): Comment[] =>
    list.map((c) => {
      if (c.id === commentId) return { ...c, ...upd };
      return { ...c, replies: c.replies ? updateCommentInTree(c.replies, commentId, upd) : c.replies };
    });

  const removeCommentFromTree = (list: Comment[], commentId: string): Comment[] =>
    list.filter((c) => c.id !== commentId).map((c) => ({ ...c, replies: c.replies ? removeCommentFromTree(c.replies, commentId) : c.replies }));

  const countComments = (list: Comment[]): number =>
    list.reduce((sum, c) => sum + 1 + (c.replies ? countComments(c.replies) : 0), 0);

  const findInTree = (list: Comment[], commentId: string): Comment | null => {
    for (const c of list) {
      if (c.id === commentId) return c;
      if (c.replies?.length) { const found = findInTree(c.replies, commentId); if (found) return found; }
    }
    return null;
  };

  const handleCommentLike = async (commentId: string) => {
    const res = await fetch(`/api/community/comments/${commentId}/like`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (res.ok) {
      setComments((prev) => {
        const cur = findInTree(prev, commentId);
        const delta = data.liked ? 1 : -1;
        return updateCommentInTree(prev, commentId, { liked: data.liked, likeCount: (cur?.likeCount ?? 0) + delta });
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/community/comments/${commentId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setComments((prev) => {
        const next = removeCommentFromTree(prev, commentId);
        if (post) setPost((p) => (p ? { ...p, commentCount: countComments(next) } : null));
        return next;
      });
    }
  };

  const openReport = (targetType: "post" | "comment", targetId: string) => {
    setReportTarget({ type: targetType, id: targetId });
    setReportReason("OTHER");
  };

  const handleReportSubmit = async () => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          reason: reportReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReportTarget(null);
        alert("신고가 접수되었습니다.");
      } else {
        alert(data.error ?? "신고 처리에 실패했습니다.");
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleReport = (targetType: "post" | "comment", targetId: string) => {
    openReport(targetType, targetId);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6"><p className="text-gray-500">불러오는 중…</p></div>
      </main>
    );
  }
  if (!post) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-red-600">글을 찾을 수 없습니다.</p>
          <Link href="/community" className="mt-2 inline-block text-site-primary underline">커뮤니티로</Link>
        </div>
      </main>
    );
  }

  if (post.isHidden && "hiddenMessage" in post) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
            <span>/</span>
            <Link href={listHref} className="hover:text-site-primary">{post.boardName}</Link>
          </nav>
          <p className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 text-gray-600 dark:text-gray-400">
            {(post as { hiddenMessage?: string }).hiddenMessage ?? "관리자에 의해 숨김 처리된 내용입니다."}
          </p>
          <Link href={listHref} className="mt-4 inline-block text-site-primary underline">목록으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <Link href={listHref} className="hover:text-site-primary">{post.boardName}</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium line-clamp-1">{post.title}</span>
        </nav>

        <article className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="p-4 sm:p-6">
            <h1 className="text-xl font-bold text-site-text">{post.title}</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {post.authorName} · {new Date(post.createdAt).toLocaleString("ko-KR")} · 추천 {post.likeCount} · 조회 {post.viewCount}
            </p>
            <div className="mt-4 prose prose-sm dark:prose-invert max-w-none text-site-text whitespace-pre-wrap">
              {post.content}
            </div>
            {post.imageUrls?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.imageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <Image src={url} alt="" width={240} height={160} className="rounded-lg object-cover" unoptimized />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLike}
                disabled={likeLoading}
                className={`py-2 px-4 rounded-lg text-sm font-medium ${post.liked ? "bg-site-primary text-white" : "border border-gray-300 dark:border-slate-600"}`}
              >
                추천 {post.likeCount}
              </button>
              <button
                type="button"
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                className={`py-2 px-4 rounded-lg text-sm font-medium ${post.bookmarked ? "bg-amber-500 text-white" : "border border-gray-300 dark:border-slate-600"}`}
              >
                {post.bookmarked ? "북마크됨" : "북마크"}
              </button>
              {post.canEdit && (
                <>
                  <Link href={editHref} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium">
                    수정
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("삭제할까요?")) return;
                      const res = await fetch(`/api/community/posts/${postId}`, { method: "DELETE", credentials: "include" });
                      if (res.ok) router.push(deleteRedirect);
                    }}
                    className="py-2 px-4 rounded-lg border border-red-300 text-red-600 text-sm font-medium"
                  >
                    삭제
                  </button>
                </>
              )}
              <button type="button" onClick={() => handleReport("post", postId)} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-600 dark:text-gray-400">
                신고
              </button>
            </div>
          </div>
        </article>

        <section className="mt-8" aria-labelledby="comments-heading">
          <h2 id="comments-heading" className="text-lg font-semibold mb-4">댓글 ({post.commentCount})</h2>
          <form onSubmit={handleSubmitComment} className="mb-4">
            {replyToId && (
              <p className="text-sm text-gray-500 mb-1">답글 작성 중 <button type="button" onClick={() => setReplyToId(null)} className="text-site-primary underline">취소</button></p>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder={replyToId ? "답글을 입력하세요." : "댓글을 입력하세요."}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
              id="comment-input"
            />
            <button type="submit" disabled={submittingComment || !commentText.trim()} className="mt-2 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium disabled:opacity-50">
              {submittingComment ? "등록 중…" : replyToId ? "답글 등록" : "댓글 등록"}
            </button>
          </form>
          <ul className="space-y-3">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onLike={handleCommentLike}
                onDelete={handleDeleteComment}
                onReply={setReplyToId}
                onReport={(targetId) => handleReport("comment", targetId)}
              />
            ))}
          </ul>
        </section>

        {reportTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="report-title">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full mx-4 p-4">
              <h3 id="report-title" className="text-lg font-semibold mb-3">신고 사유 선택</h3>
              <div className="space-y-2 mb-4">
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="reportReason" value={r.value} checked={reportReason === r.value} onChange={() => setReportReason(r.value)} className="rounded" />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setReportTarget(null)} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600">
                  취소
                </button>
                <button type="button" onClick={handleReportSubmit} disabled={reportSubmitting} className="py-2 px-4 rounded-lg bg-site-primary text-white disabled:opacity-50">
                  {reportSubmitting ? "처리 중…" : "신고하기"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
