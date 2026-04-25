import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getUserById, type TournamentApplicationStatus } from "../../../../../lib/platform-api";
import { listTournamentApplicationsByUserIdFirestore } from "../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

function isTournamentOngoing(dateText: string): boolean {
  const parsed = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= Date.now();
}

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const applications = await listTournamentApplicationsByUserIdFirestore(user.id);
  const rows = await Promise.all(
    applications.map(async (application) => ({
      application,
      tournament: await getTournamentByIdFirestore(application.tournamentId),
    })),
  );

  const historyRows = rows
    .filter((row) => {
      if (!row.tournament) return false;
      const ongoingApproved =
        row.application.status === "APPROVED" && isTournamentOngoing(row.tournament.date);
      const ongoingApplied =
        row.application.status === "APPLIED" && isTournamentOngoing(row.tournament.date);
      const ongoingIncomplete =
        row.application.status === "VERIFYING" || row.application.status === "WAITING_PAYMENT";
      const isActiveMypageItem = ongoingApproved || ongoingApplied || ongoingIncomplete;
      return !isActiveMypageItem;
    })
    .sort((a, b) => {
      const aTime = a.application.statusChangedAt || a.application.updatedAt || a.application.createdAt;
      const bTime = b.application.statusChangedAt || b.application.updatedAt || b.application.createdAt;
      return bTime.localeCompare(aTime);
    });

  return NextResponse.json({
    rows: historyRows.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status as TournamentApplicationStatus,
      tournamentTitle: row.tournament?.title ?? "대회",
      dateLine: (row.application.statusChangedAt || row.application.updatedAt || row.application.createdAt).slice(0, 10),
    })),
  });
}
