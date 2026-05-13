"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

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

const PARTICIPANTS_NOT_FINALIZED_MESSAGE =
  "참가자가 아직 확정되지 않았습니다.\n\n참가자 확정 후 대진표를 생성하세요.";

export default function TournamentBracketPlanCreateCard({
  tournamentId,
  bracketPlanEnabled,
  hasConfirmedBracket,
  recruitingHighlight,
}: {
  tournamentId: string;
  bracketPlanEnabled: boolean;
  hasConfirmedBracket: boolean;
  recruitingHighlight: boolean;
}) {
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const bracketManageHref = `/client/tournaments/${tournamentId}/bracket`;
  const bracketWizardHref = `/client/tournaments/${tournamentId}/bracket/wizard`;

  const secondaryOpsClass = recruitingHighlight ? " client-tournament-manage__featureCard--secondaryOps" : "";

  const closeBlockedModal = useCallback(() => setBlockedModalOpen(false), []);

  if (bracketPlanEnabled && hasConfirmedBracket) {
    return (
      <Link
        prefetch={false}
        href={bracketManageHref}
        className={`client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span${secondaryOpsClass}`}
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 관리</span>
          <span className="client-tournament-manage__featureDesc">분할·결과·인쇄</span>
        </span>
      </Link>
    );
  }

  if (bracketPlanEnabled) {
    return (
      <Link
        prefetch={false}
        href={bracketWizardHref}
        className={`client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span${secondaryOpsClass}`}
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          <span className="client-tournament-manage__featureDesc">참가확정자 기준 단순 생성</span>
        </span>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`client-tournament-manage__featureCard client-tournament-manage__featureCard--accent client-tournament-manage__featureCard--span client-tournament-manage__featureCard--blockedCreate${secondaryOpsClass}`}
        onClick={() => setBlockedModalOpen(true)}
      >
        <span className="client-tournament-manage__featureIconWrap" aria-hidden>
          <IconGrid />
        </span>
        <span className="client-tournament-manage__featureCardTextCol">
          <span className="client-tournament-manage__featureTitle">대진표 생성</span>
          <span className="client-tournament-manage__featureDesc">참가자 확정 후 이용 가능</span>
        </span>
      </button>

      {blockedModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
            boxSizing: "border-box",
          }}
          onClick={closeBlockedModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bracket-plan-blocked-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "22rem",
              background: "#fff",
              borderRadius: "12px",
              padding: "1.15rem",
              border: "1px solid #cbd5e1",
              boxShadow: "none",
              boxSizing: "border-box",
            }}
          >
            <h2 id="bracket-plan-blocked-title" style={{ margin: "0 0 0.65rem", fontSize: "1.05rem", fontWeight: 700 }}>
              안내
            </h2>
            <p
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.88rem",
                lineHeight: 1.5,
                color: "#334155",
                whiteSpace: "pre-wrap",
              }}
            >
              {PARTICIPANTS_NOT_FINALIZED_MESSAGE}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="v3-btn" onClick={closeBlockedModal} style={{ minHeight: 44, fontWeight: 700 }}>
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
