"use client";

import { useState, useEffect } from "react";

type Notification = { id: string; message: string; createdAt: string };

export default function NotificationsPopupPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm() {
    if (notifications.length === 0) return;
    setConfirming(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notificationIds: notifications.map((n) => n.id),
        }),
      });
    } finally {
      setConfirming(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("notification-popup-shown");
        if (window.opener) {
          window.opener.postMessage("notification-popup-close", window.location.origin);
          window.close();
        } else {
          window.location.href = "/";
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-site-bg p-4">
        <div className="w-full max-w-md rounded-lg border border-site-border bg-site-card p-4 shadow">
          <p className="text-sm text-gray-500">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-site-bg p-4">
        <div className="w-full max-w-md rounded-lg border border-site-border bg-site-card p-4 shadow">
          <p className="mb-3 text-sm font-semibold text-site-text">알림</p>
          <p className="text-sm text-gray-500">확인할 알림이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-site-bg p-4">
      <div className="w-full max-w-md rounded-lg border border-site-border bg-site-card p-4 shadow">
        <p className="mb-2 text-sm font-semibold text-site-text">알림</p>
        <div className="mb-3 min-h-[80px] w-full rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm text-site-text">
          <ul className="max-h-[140px] space-y-2 overflow-y-auto">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="whitespace-pre-line border-b border-gray-200 pb-2 last:mb-0 last:border-0 last:pb-0"
              >
                {n.message}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="rounded-lg bg-site-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
