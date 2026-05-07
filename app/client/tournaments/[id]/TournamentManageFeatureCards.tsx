"use client";

import Link from "next/link";
import TournamentTvLinkBlock from "./TournamentTvLinkBlock";

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM16 12h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export default function TournamentManageFeatureCards({
  tournamentId,
  bracketEnabled,
  hasConfirmedBracket,
}: {
  tournamentId: string;
  bracketEnabled: boolean;
  hasConfirmedBracket: boolean;
}) {
  const editHref = `/client/tournaments/${encodeURIComponent(tournamentId)}/edit`;
  const settlementHref = `/client/settlement/${encodeURIComponent(tournamentId)}`;
  const bracketManageHref = `/client/tournaments/${tournamentId}/bracket`;
  const bracketCreateHref = `/client/tournaments/${tournamentId}/bracket/create`;
  const participantsHref = `/client/tournaments/${tournamentId}/participants`;
  const quickResultsHref = `/client/tournaments/${tournamentId}/bracket/quick-results`;

  return (
    <div className="client-tournament-manage__hubGrid">
      <Link
        prefetch={false}
        href={editHref}
        className="client-tournament-manage__featureCard client-tournament-manage__featureCard--primary"
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconPencil />
        </span>
        <span className="client-tournament-manage__featureTitle">대회 정보 수정</span>
      </Link>
      <Link prefetch={false} href={settlementHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--success">
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconWallet />
        </span>
        <span className="client-tournament-manage__featureTitle">정산 관리</span>
      </Link>

      {bracketEnabled ? (
        hasConfirmedBracket ? (
          <Link
            prefetch={false}
            href={bracketManageHref}
            className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span"
          >
            <span className="client-tournament-manage__featureIconWrap" aria-hidden>
              <IconGrid />
            </span>
            <span className="client-tournament-manage__featureTitle">대진표 관리</span>
          </Link>
        ) : (
          <Link
            prefetch={false}
            href={bracketCreateHref}
            className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span"
          >
            <span className="client-tournament-manage__featureIconWrap" aria-hidden>
              <IconGrid />
            </span>
            <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          </Link>
        )
      ) : (
        <span className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span client-tournament-manage__featureCard--disabled">
          <span className="client-tournament-manage__featureIconWrap" aria-hidden>
            <IconGrid />
          </span>
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
        </span>
      )}

      <Link prefetch={false} href={participantsHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconUsers />
        </span>
        <span className="client-tournament-manage__featureTitle">참가자 관리</span>
      </Link>

      {bracketEnabled && hasConfirmedBracket ? (
        <Link prefetch={false} href={quickResultsHref} className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral">
          <span className="client-tournament-manage__featureIconWrap" aria-hidden>
            <IconBolt />
          </span>
          <span className="client-tournament-manage__featureTitle">빠른 결과 입력</span>
        </Link>
      ) : (
        <span className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral client-tournament-manage__featureCard--disabled">
          <span className="client-tournament-manage__featureIconWrap" aria-hidden>
            <IconBolt />
          </span>
          <span className="client-tournament-manage__featureTitle">빠른 결과 입력</span>
        </span>
      )}

      <div className="client-tournament-manage__featureCard client-tournament-manage__featureCard--neutral client-tournament-manage__featureCard--span client-tournament-manage__featureCard--tvSlot">
        <TournamentTvLinkBlock tournamentId={tournamentId} presentation="hubModal" />
      </div>
    </div>
  );
}
