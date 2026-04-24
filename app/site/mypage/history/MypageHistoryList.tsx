"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HistoryRow = {
  applicationId: string;
  tournamentId: string;
  status: string;
  tournamentTitle: string;
  dateLine: string;
};

function getHistoryStatusLabel(status: string): string {
  if (status === "APPROVED") return "참가 완료";
  if (status === "REJECTED") return "참가 불가";
  if (status === "VERIFYING") return "검증 진행중";
  if (status === "WAITING_PAYMENT") return "입금 필요";
  return "신청 접수";
}

export default function MypageHistoryList() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/site/mypage/history", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("bad");
        const data = (await res.json()) as { rows?: HistoryRow[] };
        if (!cancelled) setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) {
    return (
      <p className="v3-muted" style={{ margin: 0 }}>
        불러오는 중…
      </p>
    );
  }

  if (failed) {
    return (
      <p className="v3-muted" style={{ margin: 0 }}>
        목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="v3-muted" style={{ margin: 0 }}>
        지난 대회 기록이 없습니다.
      </p>
    );
  }

  return (
    <ul className="site-mypage-link-list">
      {rows.map((row) => (
        <li key={row.applicationId}>
          <Link href={`/site/tournaments/${row.tournamentId}`} className="site-mypage-link-row">
            <div className="site-mypage-link-main">
              <span className="site-mypage-link-title">{row.tournamentTitle}</span>
              <span className="site-mypage-link-sub">
                {getHistoryStatusLabel(row.status)} · {row.dateLine}
              </span>
            </div>
            <span className="site-mypage-link-chevron" aria-hidden>
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
