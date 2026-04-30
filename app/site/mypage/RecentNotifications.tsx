"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  relatedTournamentId: string | null;
  createdAt: string;
  isRead: boolean;
};

export default function RecentNotifications({ initialItems }: { initialItems: NotificationItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const hasUnread = useMemo(() => items.some((row) => !row.isRead), [items]);

  async function markOneRead(id: string) {
    const response = await fetch(`/api/site/notifications/${id}/read`, { method: "PATCH" });
    if (!response.ok) return false;
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, isRead: true } : row)));
    return true;
  }

  function toggleItem(item: NotificationItem) {
    if (markingAll) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
        if (!item.isRead) {
          void markOneRead(item.id);
        }
      }
      return next;
    });
  }

  async function handleMarkAllRead() {
    if (markingAll || !hasUnread) return;
    setMarkingAll(true);
    try {
      const response = await fetch("/api/site/notifications/read-all", { method: "POST" });
      if (response.ok) {
        setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
      }
    } finally {
      setMarkingAll(false);
    }
  }

  if (items.length === 0) {
    return <p className="v3-muted">최근 알림이 없습니다.</p>;
  }

  return (
    <div className="v3-stack site-mypage-notifications" style={{ gap: "0.65rem" }}>
      <div className="v3-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          type="button"
          className="secondary-button"
          disabled={!hasUnread || markingAll}
          onClick={() => void handleMarkAllRead()}
          style={{ fontSize: "0.85rem", minHeight: "42px", padding: "0 0.85rem" }}
        >
          {markingAll ? "처리 중…" : "모두 읽음으로 표시"}
        </button>
      </div>
      <ul className="site-mypage-notification-list">
        {items.map((item) => {
          const open = expandedIds.has(item.id);
          return (
            <li key={item.id} className="site-mypage-notification-item">
              <button
                type="button"
                className={`site-mypage-notification-title-btn${item.isRead ? " is-read" : ""}`}
                onClick={() => toggleItem(item)}
                aria-expanded={open}
              >
                <span className="site-mypage-notification-title-text">{item.title}</span>
                <span className="site-mypage-notification-chevron" aria-hidden>
                  {open ? "▾" : "▸"}
                </span>
              </button>
              {open ? (
                <div className="site-mypage-notification-body">
                  <p className="site-mypage-notification-message">{item.message}</p>
                  <p className="v3-muted site-mypage-notification-meta">
                    {new Date(item.createdAt).toLocaleString("ko-KR")} · {item.isRead ? "읽음" : "안읽음"}
                  </p>
                  {item.relatedTournamentId ? (
                    <p style={{ marginTop: "0.5rem" }}>
                      <Link className="secondary-button" href={`/site/tournaments/${item.relatedTournamentId}`} style={{ fontSize: "0.85rem", minHeight: "42px", padding: "0 0.85rem", display: "inline-flex" }}>
                        대회 상세 보기
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
