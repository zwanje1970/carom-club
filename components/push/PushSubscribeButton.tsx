"use client";

import { useState } from "react";

/**
 * "대진표 알림 받기" 버튼.
 * 클릭 시 브라우저 알림 허용 요청 → 구독 정보 서버 저장.
 */
export function PushSubscribeButton({
  className = "",
  label = "대진표 알림 받기",
}: {
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "subscribed" | "unsupported" | "denied" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setStatus("idle");
    setMessage("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        setMessage("이 브라우저는 푸시 알림을 지원하지 않습니다.");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        setMessage("알림이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.");
        return;
      }
      let permission: NotificationPermission = Notification.permission;
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setStatus("denied");
        setMessage("알림을 허용해 주세요.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/vapid-public");
      if (!keyRes.ok) {
        setStatus("error");
        setMessage("알림 설정을 불러올 수 없습니다.");
        return;
      }
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const j = sub.toJSON();
      const p256dh = j.keys?.p256dh ?? (sub.getKey("p256dh") ? arrayBufferToBase64(sub.getKey("p256dh")!) : "");
      const auth = j.keys?.auth ?? (sub.getKey("auth") ? arrayBufferToBase64(sub.getKey("auth")!) : "");
      const payload = {
        endpoint: j.endpoint ?? sub.endpoint,
        p256dh,
        auth,
      };
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error || "저장에 실패했습니다.");
        return;
      }
      setStatus("subscribed");
      setMessage("알림 구독이 완료되었습니다.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className || "inline-flex items-center rounded-lg border border-site-border bg-site-card px-4 py-2 text-sm font-medium text-site-text hover:bg-site-bg disabled:opacity-50"}
      >
        {loading ? "처리 중..." : label}
      </button>
      {message && (
        <p className={`text-xs ${status === "subscribed" ? "text-green-600" : status === "denied" || status === "unsupported" ? "text-amber-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
