import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resolveCanonicalUserIdForAuth } from "../../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { listTournamentApplicationsByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import {
  getLatestBracketByTournamentIdAndZoneIdFirestore,
  getLatestBracketByTournamentIdFirestore,
} from "../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { filterConfirmedParticipantEntries } from "../../client-participant-filter-shared";
import ParticipantsPrintClient, { type ParticipantsPrintRow } from "../../participants/print/ParticipantsPrintClient";

export const dynamic = "force-dynamic";

export default async function BracketAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ zoneId?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const zoneId = typeof sp.zoneId === "string" ? sp.zoneId.trim() : "";
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) notFound();

  const activeBracket =
    tournament.zonesEnabled === true && zoneId
      ? await getLatestBracketByTournamentIdAndZoneIdFirestore(id, zoneId)
      : await getLatestBracketByTournamentIdFirestore(id);

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) notFound();
  const viewerId = await resolveCanonicalUserIdForAuth(session.userId);
  if (String(tournament.createdBy ?? "").trim() !== viewerId.trim()) {
    notFound();
  }

  const entries = await listTournamentApplicationsByTournamentIdFirestore(id);
  const approved = filterConfirmedParticipantEntries(entries).sort((a, b) => a.applicantName.localeCompare(b.applicantName, "ko"));

  const rows: ParticipantsPrintRow[] = approved.map((e) => ({
    id: e.id,
    userId: typeof e.userId === "string" ? e.userId : "",
    applicantName: e.applicantName,
    phone: e.phone,
    participantAverage: e.participantAverage ?? null,
    registrationSource: e.registrationSource === "admin" ? "admin" : null,
    statusChangedAt: e.statusChangedAt,
    status: e.status,
    attendanceChecked: e.attendanceChecked === true,
  }));

  return (
    <ParticipantsPrintClient
      tournamentId={id}
      tournamentTitle={tournament.title}
      maxParticipants={tournament.maxParticipants}
      rows={rows}
      backListHref={`/client/tournaments/${encodeURIComponent(id)}/bracket`}
      pageHeading="출석 확인"
      initialAttendanceAutoReflect={activeBracket?.attendanceAutoReflect === true}
      bracketAttendancePatchQuery={zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ""}
    />
  );
}
