"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type Notification = { id: string; message: string; createdAt: string };

export default function NotificationBanner() {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function fetchNotifications() {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => setNotifications([]));
  }

  useEffect(() => {
    fetchNotifications();
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
      setDismissed(true);
      setShowDetail(false);
      fetchNotifications();
    } finally {
      setConfirming(false);
    }
  }

  if (pathname?.toLowerCase() === "/notifications-popup") return null;
  if (pathname?.startsWith("/tv")) return null;
  if (notifications.length === 0 || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-site-border bg-site-card p-4 shadow-lg">
        <p className="mb-3 text-sm font-semibold text-site-text">알림</p>

        {!showDetail ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm text-site-text">알림 {notifications.length}건</span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetail(true)}
                className="rounded-lg bg-site-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                알림 확인하기
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 min-h-[80px] w-full rounded border border-site-border bg-site-bg px-2 py-1.5 text-sm text-site-text">
              <ul className="max-h-[200px] space-y-2 overflow-y-auto">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="whitespace-pre-line border-b border-gray-200 pb-2 last:mb-0 last:border-0 last:pb-0 dark:border-slate-600"
                  >
                    {n.message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded-lg bg-site-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {confirming ? "처리 중..." : "확인"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
