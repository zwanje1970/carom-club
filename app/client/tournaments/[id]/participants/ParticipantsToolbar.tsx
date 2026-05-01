"use client";

import Link from "next/link";
import ParticipantAddSheet from "./ParticipantAddSheet";

export default function ParticipantsToolbar({ tournamentId }: { tournamentId: string }) {
  const printHref = `/client/tournaments/${tournamentId}/participants/print`;
  return (
    <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.35rem" }}>
      <ParticipantAddSheet tournamentId={tournamentId} />
      <Link
        prefetch={false}
        href={printHref}
        className="v3-btn"
        style={{ padding: "0.55rem 0.85rem", fontWeight: 700, fontSize: "0.92rem", textDecoration: "none" }}
      >
        참가자 리스트 보기
      </Link>
    </div>
  );
}
