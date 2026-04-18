import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getTournamentById,
  listTournamentApplicationsByTournamentId,
} from "../../../../../lib/server/dev-store";
import type { TournamentApplication } from "../../../../../lib/server/dev-store";
import ParticipantListRow from "./ParticipantListRow";

export const dynamic = "force-dynamic";

const FILTER_KEYS = ["all", "approved", "wait", "reject"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function parseFilter(raw: string | undefined): FilterKey {
  if (raw === "approved" || raw === "wait" || raw === "reject") return raw;
  return "all";
}

function filterEntries(entries: TournamentApplication[], key: FilterKey): TournamentApplication[] {
  if (key === "approved") return entries.filter((e) => e.status === "APPROVED");
  if (key === "wait") return entries.filter((e) => e.status === "WAITING_PAYMENT");
  if (key === "reject") return entries.filter((e) => e.status === "REJECTED");
  return entries;
}

function countBy(entries: TournamentApplication[]) {
  return {
    all: entries.length,
    approved: entries.filter((e) => e.status === "APPROVED").length,
    wait: entries.filter((e) => e.status === "WAITING_PAYMENT").length,
    reject: entries.filter((e) => e.status === "REJECTED").length,
  };
}

export default async function ClientTournamentParticipantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  const tournament = await getTournamentById(id);
  if (!tournament) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const canView = Boolean(session && tournament.createdBy === session.userId);
  if (!canView) notFound();

  const entries = await listTournamentApplicationsByTournamentId(id);
  const selected = parseFilter(f);
  const filteredEntries = filterEntries(entries, selected);
  const counts = countBy(entries);

  const base = `/client/tournaments/${id}/participants`;

  return (
    <main className="v3-page v3-stack" style={{ gap: 0, paddingTop: 0 }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#fff",
          paddingBottom: "0.65rem",
          marginBottom: "0.5rem",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div className="v3-row" style={{ alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href={`/client/tournaments/${id}`} style={{ padding: "0.45rem 0.75rem" }}>
            ← 대회로 돌아가기
          </Link>
        </div>
        <h1 className="v3-h1" style={{ margin: "0.5rem 0 0.25rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {tournament.title}
        </h1>
        <p style={{ margin: 0, fontSize: "0.95rem", color: "#374151" }}>
          참가자 <strong>{entries.length}</strong>명
        </p>
        <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
          참가자 관리
        </p>
      </header>

      <section className="v3-stack" style={{ gap: "0.5rem", marginBottom: "0.65rem" }}>
        <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <Link
            className="v3-btn"
            href={base}
            style={{
              padding: "0.45rem 0.7rem",
              fontWeight: 600,
              background: selected === "all" ? "#eaf5ff" : "#fff",
              borderColor: selected === "all" ? "#7bb8ff" : "#d7d7d7",
            }}
          >
            전체 ({counts.all})
          </Link>
          <Link
            className="v3-btn"
            href={`${base}?f=approved`}
            style={{
              padding: "0.45rem 0.7rem",
              fontWeight: 600,
              background: selected === "approved" ? "#eaf5ff" : "#fff",
              borderColor: selected === "approved" ? "#7bb8ff" : "#d7d7d7",
            }}
          >
            승인 ({counts.approved})
          </Link>
          <Link
            className="v3-btn"
            href={`${base}?f=wait`}
            style={{
              padding: "0.45rem 0.7rem",
              fontWeight: 600,
              background: selected === "wait" ? "#eaf5ff" : "#fff",
              borderColor: selected === "wait" ? "#7bb8ff" : "#d7d7d7",
            }}
          >
            대기 ({counts.wait})
          </Link>
          <Link
            className="v3-btn"
            href={`${base}?f=reject`}
            style={{
              padding: "0.45rem 0.7rem",
              fontWeight: 600,
              background: selected === "reject" ? "#eaf5ff" : "#fff",
              borderColor: selected === "reject" ? "#7bb8ff" : "#d7d7d7",
            }}
          >
            거절 ({counts.reject})
          </Link>
        </div>
      </section>

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
              tournamentId={id}
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
            />
          ))
        )}
      </section>
    </main>
  );
}
