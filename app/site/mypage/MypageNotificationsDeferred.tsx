"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MypageClientMenuPayload, NotificationItem } from "./mypage-client-types";

const RecentNotifications = dynamic(() => import("./RecentNotifications"), {
  ssr: false,
  loading: () => (
    <p className="v3-muted" style={{ margin: 0 }}>
      불러오는 중…
    </p>
  ),
});

export default function MypageNotificationsDeferred({
  onNotificationsMenuMeta,
}: {
  onNotificationsMenuMeta?: (p: MypageClientMenuPayload) => void;
}) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/site/mypage?part=notifications", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad");
        const json = (await res.json()) as {
          notifications: NotificationItem[];
          clientApplicationStatus: MypageClientMenuPayload["clientApplicationStatus"];
        };
        if (cancelled) return;
        setItems(json.notifications);
        onNotificationsMenuMeta?.({ clientApplicationStatus: json.clientApplicationStatus });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onNotificationsMenuMeta]);

  if (failed) {
    return (
      <section className="card-clean site-detail-inner-stack">
        <h2 className="site-mypage-card-title">최근 알림</h2>
        <p className="v3-muted" style={{ margin: 0 }}>
          불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </section>
    );
  }

  if (items === null) {
    return (
      <section className="card-clean site-detail-inner-stack">
        <h2 className="site-mypage-card-title">최근 알림</h2>
        <p className="v3-muted" style={{ margin: 0 }}>
          불러오는 중…
        </p>
      </section>
    );
  }

  return (
    <section className="card-clean site-detail-inner-stack">
      <h2 className="site-mypage-card-title">최근 알림</h2>
      <RecentNotifications initialItems={items} />
    </section>
  );
}
