"use client";

import Link from "next/link";
import {
  getMypageTournamentApplicationStatusLabel,
  type MypageApplicationStatusLabelInput,
} from "../../../lib/site/mypage-tournament-application-status-label";

export type MypageApplicationRowPayload = MypageApplicationStatusLabelInput & {
  applicationId: string;
  tournamentId: string;
  createdAt: string;
  tournamentTitle: string;
  tournamentDate: string;
};

export default function MypageApplicationsList({ rows }: { rows: MypageApplicationRowPayload[] }) {
  if (rows.length === 0) {
    return (
      <p className="v3-muted" style={{ margin: 0 }}>
        진행 중인 신청이 없습니다.
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
                {getMypageTournamentApplicationStatusLabel(row)} · {row.tournamentDate || row.createdAt.slice(0, 10)}
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
