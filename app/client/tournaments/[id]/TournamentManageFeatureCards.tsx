"use client";

import Link from "next/link";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";
import TournamentTvLinkBlock from "./TournamentTvLinkBlock";

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M8 6h4v4H8V6zM12 14h4v4h-4v-4zM4 14h4v4H4v-4zM16 6h4v4h-4V6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TournamentManageFeatureCards({
  tournamentId,
  statusBadge,
  bracketPlanEnabled,
  hasConfirmedBracket,
  operationalUnlocked,
}: {
  tournamentId: string;
  statusBadge: TournamentStatusBadge;
  bracketPlanEnabled: boolean;
  hasConfirmedBracket: boolean;
  operationalUnlocked: boolean;
}) {
  const bracketManageHref = `/client/tournaments/${tournamentId}/bracket`;
  const bracketWizardHref = `/client/tournaments/${tournamentId}/bracket/wizard`;
  const participantsHref = `/client/tournaments/${tournamentId}/participants`;
  const quickResultsHref = `/client/tournaments/${tournamentId}/bracket/quick-results`;
  const bracketViewHref = `/client/tournaments/${tournamentId}/bracket/view`;

  const recruitingHighlight = statusBadge === "모집중" || statusBadge === "마감임박";

  const applicantsCard = (
    <Link prefetch={false} href={participantsHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
      <span className="client-tournament-manage__featureIconWrap" aria-hidden>
        <IconUsers />
      </span>
      <span className="client-tournament-manage__featureCardTextCol">
        <span className="client-tournament-manage__featureTitle">신청자 관리</span>
        <span className="client-tournament-manage__featureDesc">신청·입금확인·승인·거절·수동 입력·참가자 확정</span>
      </span>
    </Link>
  );

  const bracketCard =
    bracketPlanEnabled && hasConfirmedBracket ? (
      <Link
        prefetch={false}
        href={bracketManageHref}
        className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span"
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 관리</span>
          <span className="client-tournament-manage__featureDesc">분할·되돌리기·인쇄</span>
        </span>
      </Link>
    ) : bracketPlanEnabled ? (
      <Link
        prefetch={false}
        href={bracketWizardHref}
        className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span"
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          <span className="client-tournament-manage__featureDesc">참가확정자 기준 단순 생성</span>
        </span>
      </Link>
    ) : (
      <span className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span client-tournament-manage__featureCard--disabled">
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          <span className="client-tournament-manage__featureDesc">참가자 확정 후 이용 가능</span>
        </span>
      </span>
    );

  return (
    <div className="client-tournament-manage__hubStack">
      <div className="client-tournament-manage__hubGrid">
        {recruitingHighlight ? (
          <>
            {applicantsCard}
            {bracketCard}
          </>
        ) : (
          <>
            {bracketCard}
            {applicantsCard}
          </>
        )}
      </div>

      {operationalUnlocked && hasConfirmedBracket ? (
        <section className="client-tournament-manage__operationalCard v3-box v3-stack" aria-label="대회 운영">
          <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            운영 (진행 단계)
          </p>
          <div className="client-tournament-manage__hubGrid client-tournament-manage__hubGrid--operational">
            <Link prefetch={false} href={quickResultsHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
              <span className="client-tournament-manage__featureIconWrap" aria-hidden>
                <IconBolt />
              </span>
              <span className="client-tournament-manage__featureCardTextCol">
                <span className="client-tournament-manage__featureTitle">운영용 리스트 입력</span>
                <span className="client-tournament-manage__featureDesc">빠른 결과 입력 (동일 데이터)</span>
              </span>
            </Link>
            <Link prefetch={false} href={bracketViewHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
              <span className="client-tournament-manage__featureIconWrap" aria-hidden>
                <IconEye />
              </span>
              <span className="client-tournament-manage__featureCardTextCol">
                <span className="client-tournament-manage__featureTitle">대진표 보기</span>
                <span className="client-tournament-manage__featureDesc">전체 화면 보드</span>
              </span>
            </Link>
            <Link prefetch={false} href={participantsHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
              <span className="client-tournament-manage__featureIconWrap" aria-hidden>
                <IconUsers />
              </span>
              <span className="client-tournament-manage__featureCardTextCol">
                <span className="client-tournament-manage__featureTitle">출석 확인</span>
                <span className="client-tournament-manage__featureDesc">신청자 관리 명단에서 출석 체크</span>
              </span>
            </Link>
            <div className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral client-tournament-manage__featureCard--tvSlot">
              <TournamentTvLinkBlock tournamentId={tournamentId} presentation="hubModal" />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
