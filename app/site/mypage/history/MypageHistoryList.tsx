"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type MypageHistoryRow = {
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

export default function MypageHistoryList({
  initialRows,
}: {
  /** 서버(RSC)에서 넘기면 `/api/site/mypage/history` 재호출 없음 */
  initialRows?: MypageHistoryRow[];
}) {
  const [rows, setRows] = useState<MypageHistoryRow[] | null>(() => (initialRows !== undefined ? initialRows : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initialRows !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/site/mypage/history", { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("bad");
        const data = (await res.json()) as { rows?: MypageHistoryRow[] };
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
  }, [initialRows]);

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
          <Link href={`/site/tournaments/${row.tournamentId}`} prefetch={false} className="site-mypage-link-row">
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
