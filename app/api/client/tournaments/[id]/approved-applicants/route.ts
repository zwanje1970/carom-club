import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthRole } from "../../../../../../lib/auth/roles";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getUserById, getClientStatusByUserId, resolveCanonicalUserIdForAuth } from "../../../../../../lib/platform-api";
import { assertClientCanManageTournamentFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { listTournamentApplicationsByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import { firestoreGetUserById } from "../../../../../../lib/server/firestore-users";

export const runtime = "nodejs";

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  if (user.role === "PLATFORM") return { user, allowed: true as const };
  if (user.role !== "CLIENT") return { user, allowed: false as const, reason: "client-role-required" as const };
  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") return { user, allowed: false as const, reason: "client-not-approved" as const };
  return { user, allowed: true as const };
}

async function actorTournamentUserId(user: { id: string; role: AuthRole }): Promise<string> {
  if (user.role === "PLATFORM") return user.id;
  return resolveCanonicalUserIdForAuth(user.id);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!auth.allowed) return NextResponse.json({ error: "접근 권한이 없습니다.", reason: auth.reason }, { status: 403 });

  const { id: tournamentId } = await context.params;
  const tid = (tournamentId ?? "").trim();
  if (!tid) return NextResponse.json({ error: "대회 ID가 필요합니다." }, { status: 400 });

  const actorId = await actorTournamentUserId(auth.user);
  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: actorId,
    actorRole: auth.user.role,
    tournamentId: tid,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.httpStatus });
  }

  const apps = await listTournamentApplicationsByTournamentIdFirestore(tid);
  const approved = apps.filter((a) => a.status === "APPROVED");
  const seen = new Set<string>();
  const applicants: { userId: string; name: string; pushMarketingAgreed: boolean }[] = [];

  for (const a of approved) {
    const uid = String(a.userId ?? "").trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const u = await firestoreGetUserById(uid);
    const pushMarketingAgreed = u ? u.pushMarketingAgreed !== false : true;
    const name = typeof a.applicantName === "string" && a.applicantName.trim() ? a.applicantName.trim() : "—";
    applicants.push({ userId: uid, name, pushMarketingAgreed });
  }

  return NextResponse.json({ applicants });
}
