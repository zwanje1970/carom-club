"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MypageApplicationRowPayload } from "./MypageApplicationsList";

const MypageApplicationsList = dynamic(() => import("./MypageApplicationsList"), {
  ssr: false,
  loading: () => (
    <p className="v3-muted" style={{ margin: 0 }}>
      불러오는 중…
    </p>
  ),
});

export default function MypageApplicationsDeferred() {
  const [rows, setRows] = useState<MypageApplicationRowPayload[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/site/mypage?part=applications", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad");
        const json = (await res.json()) as { applicationRows: MypageApplicationRowPayload[] };
        if (cancelled) return;
        setRows(json.applicationRows);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <section className="card-clean site-detail-inner-stack">
        <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
        <p className="v3-muted" style={{ margin: 0 }}>
          불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </section>
    );
  }

  if (rows === null) {
    return (
      <section className="card-clean site-detail-inner-stack">
        <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
        <p className="v3-muted" style={{ margin: 0 }}>
          불러오는 중…
        </p>
      </section>
    );
  }

  return (
    <section className="card-clean site-detail-inner-stack">
      <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
      <MypageApplicationsList rows={rows} />
    </section>
  );
}
