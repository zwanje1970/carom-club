"use client";

import Link from "next/link";
import ParticipantAddSheet from "./ParticipantAddSheet";

export default function ParticipantsToolbar({ tournamentId }: { tournamentId: string }) {
  const printHref = `/client/tournaments/${tournamentId}/participants/print`;
  return (
    <div
      className="v3-row"
      style={{
        flexWrap: "wrap",
        gap: "0.3rem",
        alignItems: "center",
        marginTop: 0,
        touchAction: "manipulation",
      }}
    >
      <ParticipantAddSheet tournamentId={tournamentId} />
      <Link
        prefetch={false}
        href={printHref}
        className="v3-btn"
        style={{
          padding: "0.32rem 0.6rem",
          minHeight: 38,
          display: "inline-flex",
          alignItems: "center",
          fontWeight: 700,
          fontSize: "0.88rem",
          textDecoration: "none",
          touchAction: "manipulation",
        }}
      >
        참가자 리스트 보기
      </Link>
    </div>
  );
}
