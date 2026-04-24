"use client";

import Link from "next/link";

export type MypageApplicationRowPayload = {
  applicationId: string;
  tournamentId: string;
  status: string;
  createdAt: string;
  tournamentTitle: string;
  tournamentDate: string;
};

function getStatusLabel(status: string): string {
  if (status === "APPLIED") return "신청 접수";
  if (status === "VERIFYING") return "검증 진행중";
  if (status === "WAITING_PAYMENT") return "입금 필요";
  if (status === "APPROVED") return "참가 확정";
  if (status === "REJECTED") return "참가 불가";
  return "진행중";
}

export default function MypageApplicationsList({ rows }: { rows: MypageApplicationRowPayload[] }) {
  if (rows.length === 0) {
    return (
      <p className="v3-muted" style={{ margin: 0 }}>
        현재 진행중 신청이 없습니다.
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
                {getStatusLabel(row.status)} · {row.tournamentDate || row.createdAt.slice(0, 10)}
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
