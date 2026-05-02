"use client";

import Link from "next/link";
import type { TournamentApplicationListItem } from "../../../../lib/types/entities";
import {
  countParticipantApplications,
  filterParticipantEntries,
  type ClientParticipantFilterKey,
} from "./client-participant-filter-shared";
import ParticipantListRow from "./participants/ParticipantListRow";
import ParticipantsToolbar from "./participants/ParticipantsToolbar";

type Props = {
  tournamentId: string;
  entries: TournamentApplicationListItem[];
  selected: ClientParticipantFilterKey;
  filterBaseHref: string;
};

function filterLinkStyle(selected: ClientParticipantFilterKey, key: ClientParticipantFilterKey) {
  const on = selected === key;
  return {
    padding: "0.45rem 0.65rem",
    fontWeight: on ? 800 : 600,
    fontSize: "0.88rem",
    background: on ? "#dbeafe" : "#fff",
    borderColor: on ? "#2563eb" : "#d7d7d7",
    color: on ? "#1e3a8a" : "#374151",
    boxShadow: on ? "0 0 0 1px #2563eb33" : "none",
    textDecoration: "none" as const,
    borderRadius: "0.35rem",
    touchAction: "manipulation" as const,
  };
}

export default function ClientTournamentParticipantsApplicationsBlock({
  tournamentId,
  entries,
  selected,
  filterBaseHref,
}: Props) {
  const filteredEntries = filterParticipantEntries(entries, selected);
  const counts = countParticipantApplications(entries);
  const base = filterBaseHref.replace(/\/$/, "");

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 25,
          background: "#fff",
          paddingBottom: "0.45rem",
          marginBottom: "0.35rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <ParticipantsToolbar tournamentId={tournamentId} />
        <div
          className="v3-row"
          style={{ flexWrap: "wrap", gap: "0.3rem", alignItems: "center", marginTop: "0.35rem" }}
        >
          <Link className="v3-btn" href={base} prefetch={false} style={filterLinkStyle(selected, "all")}>
            전체 ({counts.all})
          </Link>
          <Link className="v3-btn" href={`${base}?f=approved`} prefetch={false} style={filterLinkStyle(selected, "approved")}>
            승인 ({counts.approved})
          </Link>
          <Link className="v3-btn" href={`${base}?f=wait`} prefetch={false} style={filterLinkStyle(selected, "wait")}>
            대기 ({counts.wait})
          </Link>
          <Link className="v3-btn" href={`${base}?f=reject`} prefetch={false} style={filterLinkStyle(selected, "reject")}>
            거절 ({counts.reject})
          </Link>
        </div>
      </div>

      <section
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: "0.4rem",
          overflow: "hidden",
        }}
      >
        {filteredEntries.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, padding: "1rem" }}>
            {entries.length === 0 ? "저장된 참가신청이 없습니다." : "이 조건에 해당하는 참가자가 없습니다."}
          </p>
        ) : (
          filteredEntries.map((entry) => (
            <ParticipantListRow
              key={entry.id}
              tournamentId={tournamentId}
              entryId={entry.id}
              applicantName={entry.applicantName}
              initialStatus={entry.status}
              phone={entry.phone}
              createdShort={new Date(entry.createdAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              registrationSource={entry.registrationSource ?? null}
              participantAverage={entry.participantAverage ?? null}
              adminNote={entry.adminNote ?? null}
            />
          ))
        )}
      </section>
    </>
  );
}
