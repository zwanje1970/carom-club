"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchAuthSessionCached, invalidateAuthSessionFetchCache } from "../../lib/client/auth-session-fetch-cache";
import styles from "./mobile-splash.module.css";

const MAX_WAIT_MS = 3000;

/**
 * 앱(WebView) 전용: 네이티브 스플래시 동안 세션 확인 후 메인으로 이동.
 * 위치·대회 상세·관리자 데이터는 호출하지 않는다.
 */
export default function MobileAppSplashClient() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let navigated = false;
    invalidateAuthSessionFetchCache();

    const t0 = Date.now();
    let maxTimer: number | undefined;

    const goHome = () => {
      if (cancelled || navigated) return;
      navigated = true;
      if (maxTimer !== undefined) window.clearTimeout(maxTimer);
      void router.prefetch("/");
      router.replace("/");
    };

    const tryGoHome = () => {
      if (cancelled || navigated) return;
      const elapsed = Date.now() - t0;
      if (elapsed >= MAX_WAIT_MS) {
        goHome();
      }
    };

    maxTimer = window.setTimeout(tryGoHome, MAX_WAIT_MS);

    void fetchAuthSessionCached()
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        tryGoHome();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(maxTimer);
    };
  }, [router]);

  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <Image
        src="/images/mobile-app-splash.png"
        alt="캐롬클럽"
        width={512}
        height={512}
        priority
        className={styles.logo}
      />
    </div>
  );
}
