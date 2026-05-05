"use client";

import Link from "next/link";

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

export default function TournamentManageFeatureCards({
  tournamentId,
  bracketEnabled,
  hasConfirmedBracket,
}: {
  tournamentId: string;
  bracketEnabled: boolean;
  hasConfirmedBracket: boolean;
}) {
  const editHref = `/client/tournaments/new?edit=${encodeURIComponent(tournamentId)}`;
  const settlementHref = `/client/settlement/${encodeURIComponent(tournamentId)}`;
  const bracketManageHref = `/client/tournaments/${tournamentId}/bracket`;
  const bracketCreateHref = `/client/tournaments/${tournamentId}/bracket/create`;

  return (
    <div className="client-tournament-manage__featureGrid">
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
            className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent"
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
            className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent"
          >
            <span className="client-tournament-manage__featureIconWrap" aria-hidden>
              <IconGrid />
            </span>
            <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          </Link>
        )
      ) : (
        <span className="client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--disabled">
          <span className="client-tournament-manage__featureIconWrap" aria-hidden>
            <IconGrid />
          </span>
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
        </span>
      )}
    </div>
  );
}
