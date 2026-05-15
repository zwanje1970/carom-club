"use client";

import { useEffect, useState } from "react";

const MAIN_SITE_NOTICE_FETCH_DELAY_MS = 2_500;

type SiteNoticePayload = {
  enabled: boolean;
  text: string;
};

export function MainSiteDeferredNotice({
  onVisibleChange,
}: {
  onVisibleChange?: (visible: boolean) => void;
}) {
  const [notice, setNotice] = useState<SiteNoticePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/site/home-notice", { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as SiteNoticePayload;
          if (cancelled) return;
          setNotice({
            enabled: Boolean(json.enabled),
            text: typeof json.text === "string" ? json.text : "",
          });
        } catch {
          /* 메인 슬라이드와 분리 — 실패 시 공지 없음 */
        }
      })();
    }, MAIN_SITE_NOTICE_FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const showBar = Boolean(notice?.enabled) && (notice?.text.trim().length ?? 0) > 0;

  useEffect(() => {
    onVisibleChange?.(showBar);
  }, [onVisibleChange, showBar]);

  return (
    <div
      className="site-home-main-notice-strip"
      aria-live={showBar ? "polite" : undefined}
      role={showBar ? "status" : undefined}
      aria-hidden={showBar ? undefined : "true"}
    >
      <div className="site-home-main-notice-strip__inner">
        {showBar ? <span className="site-home-main-notice-strip__text">{notice!.text.trim()}</span> : null}
      </div>
    </div>
  );
}
