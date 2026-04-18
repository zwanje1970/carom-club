import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import {
  checkClientFeatureAccessByUserId,
  getTournamentById,
  getUserById,
  listSettlementEntriesByTournamentId,
} from "../../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function requireSettlementAccess(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };

  if (user.role === "PLATFORM") {
    return { ok: true as const, tournament };
  }
  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await checkClientFeatureAccessByUserId({ userId: user.id, feature: "SETTLEMENT" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }
  if (tournament.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }
  return { ok: true as const, tournament };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireSettlementAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.max(1, Math.min(50, limitRaw));

  const entriesResult = await listSettlementEntriesByTournamentId(id);
  if (!entriesResult.ok) {
    return NextResponse.json({ error: entriesResult.error }, { status: 400 });
  }

  const totalCount = entriesResult.entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const entries = entriesResult.entries.slice(start, start + limit);

  return NextResponse.json({
    tournament: { id: auth.tournament.id, title: auth.tournament.title },
    pagination: {
      page: safePage,
      limit,
      totalCount,
      totalPages,
    },
    entries,
  });
}
