"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  type: string;
  postId: string;
  commentId: string | null;
  relatedUserName: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function CommunityNotificationsPage() {
  const [list, setList] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/community/notifications?list=1", { credentials: "include" })
      .then((res) => res.ok ? res.json() : { list: [], unreadCount: 0 })
      .then((data) => {
        setList(data.list ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markReadAndGo = (n: NotificationItem) => {
    const url = n.commentId
      ? `/community/posts/${n.postId}#comment-${n.commentId}`
      : `/community/posts/${n.postId}`;
    if (!n.readAt) {
      fetch(`/api/community/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" }).then(() => {
        setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    window.location.href = url;
  };

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">알림</span>
        </nav>
        <h1 className="text-xl font-bold mb-4">
          알림
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium rounded-full bg-site-primary text-white">
              {unreadCount}
            </span>
          )}
        </h1>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500">알림이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-600 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => markReadAndGo(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition ${!n.readAt ? "bg-site-primary/5 dark:bg-site-primary/10" : ""}`}
                >
                  <p className="text-sm">
                    {n.type === "reply_to_comment" ? (
                      <><strong>{n.relatedUserName ?? "알 수 없음"}</strong>님이 내 댓글에 답글을 남겼습니다.</>
                    ) : (
                      <><strong>{n.relatedUserName ?? "알 수 없음"}</strong>님이 내 글에 댓글을 남겼습니다.</>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(n.createdAt).toLocaleString("ko-KR")}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
