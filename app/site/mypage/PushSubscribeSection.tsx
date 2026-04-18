"use client";

/** 비활성화: 마이페이지 등에 연결하지 않음. FCM 앱푸시로 전환. */

import { useCallback, useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getPermissionLabel(): "허용됨" | "차단됨" | "미설정" {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "미설정";
  if (Notification.permission === "granted") return "허용됨";
  if (Notification.permission === "denied") return "차단됨";
  return "미설정";
}

type Props = {
  vapidPublicKey: string | null;
};

export default function PushSubscribeSection({ vapidPublicKey }: Props) {
  const [permissionLabel, setPermissionLabel] = useState<"허용됨" | "차단됨" | "미설정">("미설정");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setPermissionLabel(getPermissionLabel());
  }, []);

  const keyReady = useMemo(() => Boolean(vapidPublicKey && vapidPublicKey.trim()), [vapidPublicKey]);

  const refreshPermission = useCallback(() => {
    setPermissionLabel(getPermissionLabel());
  }, []);

  const onSubscribe = useCallback(async () => {
    setHint(null);
    if (!keyReady || !vapidPublicKey) {
      setHint("서버에 푸시 공개키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)가 설정되지 않았습니다.");
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setHint("이 브라우저에서는 웹 푸시를 지원하지 않습니다.");
      return;
    }
    if (!window.isSecureContext) {
      setHint("보안 연결(HTTPS 또는 localhost)에서만 알림을 설정할 수 있습니다.");
      return;
    }

    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update().catch(() => {});

      const perm = await Notification.requestPermission();
      refreshPermission();
      if (perm !== "granted") {
        setHint(perm === "denied" ? "브라우저 설정에서 알림을 허용해 주세요." : "알림 권한이 필요합니다.");
        return;
      }

      const ready = await navigator.serviceWorker.ready;
      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey.trim()) as BufferSource,
      });

      const payload = sub.toJSON();
      const res = await fetch("/api/site/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: payload }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setHint(data.error ?? "구독 저장에 실패했습니다.");
        return;
      }
      setHint("알림 구독이 저장되었습니다.");
    } catch {
      setHint("알림 구독 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
      refreshPermission();
    }
  }, [keyReady, vapidPublicKey, refreshPermission]);

  return (
    <section className="v3-box v3-stack">
      <h2 className="v3-h2">브라우저 알림</h2>
      <p className="v3-muted">
        알림 권한 상태: <strong>{permissionLabel}</strong>
        {!keyReady ? " · 푸시 공개키 미설정" : null}
      </p>
      <button type="button" className="v3-btn" disabled={busy} onClick={onSubscribe}>
        {busy ? "처리 중…" : "알림 받기"}
      </button>
      {hint ? <p className="v3-muted">{hint}</p> : null}
    </section>
  );
}
