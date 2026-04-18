"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const hasUnread = useMemo(() => items.some((row) => !row.isRead), [items]);

  async function markOneRead(id: string) {
    const response = await fetch(`/api/site/notifications/${id}/read`, { method: "PATCH" });
    if (!response.ok) return false;
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, isRead: true } : row)));
    return true;
  }

  async function handleRowClick(item: NotificationItem) {
    if (loadingId || markingAll) return;
    setLoadingId(item.id);
    try {
      if (!item.isRead) {
        try {
          await markOneRead(item.id);
        } catch {
          /* 읽음 API 실패 시에도 대회 이동은 시도 */
        }
      }
      if (item.relatedTournamentId) {
        router.push(`/site/tournaments/${item.relatedTournamentId}`);
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleMarkAllRead() {
    if (markingAll || loadingId || !hasUnread) return;
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
    return <p className="v3-muted">새 알림이 없습니다.</p>;
  }

  return (
    <div className="v3-stack" style={{ gap: "0.65rem" }}>
      <div className="v3-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          type="button"
          className="v3-btn"
          disabled={!hasUnread || markingAll || loadingId !== null}
          onClick={() => void handleMarkAllRead()}
          style={{ fontSize: "0.88rem", padding: "0.4rem 0.75rem" }}
        >
          {markingAll ? "처리 중…" : "모두 읽음으로 표시"}
        </button>
      </div>
      <ul className="v3-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="v3-btn"
              disabled={loadingId === item.id || markingAll}
              onClick={() => void handleRowClick(item)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                background: item.isRead ? "#f5f5f5" : "#eef6ff",
                padding: "0.25rem",
                cursor: loadingId === item.id ? "wait" : "pointer",
              }}
            >
              <strong style={{ fontWeight: item.isRead ? 600 : 700 }}>{item.title}</strong>
              <br />
              <span className="v3-muted">{item.message}</span>
              <br />
              <span className="v3-muted">
                {new Date(item.createdAt).toLocaleString("ko-KR")} · {item.isRead ? "읽음" : "안읽음"}
                {item.relatedTournamentId ? " · 대회 상세로 이동" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
