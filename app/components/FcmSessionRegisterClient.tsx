"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type CaromWindow = Window & {
  caromNativeGetFcmToken?: () => string | Promise<string>;
  __caromRegisterFcmToken?: (token: string, platform?: string) => Promise<void>;
};

async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return data.authenticated === true;
  } catch {
    return false;
  }
}

async function postRegister(token: string, platform: string): Promise<void> {
  await fetch("/api/site/fcm/register", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform }),
  });
}

async function resolveNativeToken(): Promise<{ token: string; platform: string } | null> {
  const w = window as CaromWindow;
  if (typeof w.caromNativeGetFcmToken !== "function") return null;
  try {
    const t = await Promise.resolve(w.caromNativeGetFcmToken());
    if (typeof t === "string" && t.trim().length > 0) {
      return { token: t.trim(), platform: "android" };
    }
  } catch {
    /* native optional */
  }
  return null;
}

let firebaseAppPromise: Promise<import("firebase/app").FirebaseApp> | null = null;

async function getFirebaseApp(): Promise<import("firebase/app").FirebaseApp | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !messagingSenderId || !appId) return null;

  if (!firebaseAppPromise) {
    firebaseAppPromise = (async () => {
      const { initializeApp, getApps } = await import("firebase/app");
      if (getApps().length > 0) return getApps()[0]!;
      const authDomain =
        (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim() || `${projectId}.firebaseapp.com`;
      return initializeApp({ apiKey, authDomain, projectId, messagingSenderId, appId });
    })();
  }
  return firebaseAppPromise;
}

async function resolveFirebaseWebToken(): Promise<{ token: string; platform: string } | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const app = await getFirebaseApp();
    if (!app) return null;

    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return null;

    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.register("/api/internal/firebase-messaging-sw", {
      scope: "/",
    });
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (typeof token === "string" && token.trim().length > 0) {
      return { token: token.trim(), platform: "web" };
    }
  } catch {
    /* web FCM optional */
  }
  return null;
}

/** 로그인 시 FCM 토큰을 `/api/site/fcm/register`로 전송. WebView: `caromNativeGetFcmToken` / `__caromRegisterFcmToken`. */
export default function FcmSessionRegisterClient() {
  const busy = useRef(false);
  const pathname = usePathname();

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!(await isAuthenticated())) return;
      const native = await resolveNativeToken();
      const web = native ? null : await resolveFirebaseWebToken();
      const pair = native ?? web;
      if (!pair) return;
      await postRegister(pair.token, pair.platform);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void run();
  }, [pathname, run]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onFocus = () => void run();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [run]);

  useEffect(() => {
    const w = window as CaromWindow;
    w.__caromRegisterFcmToken = async (token: string, platform = "android") => {
      const t = typeof token === "string" ? token.trim() : "";
      if (!t) return;
      if (!(await isAuthenticated())) return;
      await postRegister(t, typeof platform === "string" && platform.trim() ? platform.trim() : "android");
    };
    return () => {
      delete w.__caromRegisterFcmToken;
    };
  }, []);

  return null;
}
