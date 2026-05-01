"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchAuthSessionCached, invalidateAuthSessionFetchCache } from "../../lib/client/auth-session-fetch-cache";
import styles from "./mobile-splash.module.css";

const MAX_WAIT_MS = 2000;

/**
 * 앱(WebView) 전용: 네이티브 스플래시 이후 최소 준비(세션·권한 확인) 후 메인으로 이동.
 * 위치·대회 상세·게시판 전체 목록 등은 여기서 호출하지 않는다.
 */
export default function MobileAppSplashClient() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    invalidateAuthSessionFetchCache();

    const timer = window.setTimeout(() => {
      if (!cancelled) router.replace("/");
    }, MAX_WAIT_MS);

    void fetchAuthSessionCached()
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(timer);
        if (!cancelled) router.replace("/");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
