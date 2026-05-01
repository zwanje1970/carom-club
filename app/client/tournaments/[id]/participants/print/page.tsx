import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resolveCanonicalUserIdForAuth } from "../../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { listTournamentApplicationsByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import ParticipantsPrintClient, { type ParticipantsPrintRow } from "./ParticipantsPrintClient";

export const dynamic = "force-dynamic";

export default async function ClientTournamentParticipantsPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) notFound();

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) notFound();
  const viewerId = await resolveCanonicalUserIdForAuth(session.userId);
  if (String(tournament.createdBy ?? "").trim() !== viewerId.trim()) {
    notFound();
  }

  const entries = await listTournamentApplicationsByTournamentIdFirestore(id);
  const approved = entries.filter((e) => e.status === "APPROVED").sort((a, b) => a.applicantName.localeCompare(b.applicantName, "ko"));

  const rows: ParticipantsPrintRow[] = approved.map((e) => ({
    id: e.id,
    applicantName: e.applicantName,
    phone: e.phone,
    participantAverage: e.participantAverage ?? null,
    registrationSource: e.registrationSource === "admin" ? "admin" : null,
    statusChangedAt: e.statusChangedAt,
    status: e.status,
    attendanceChecked: e.attendanceChecked === true,
  }));

  return <ParticipantsPrintClient tournamentId={id} tournamentTitle={tournament.title} rows={rows} />;
}
