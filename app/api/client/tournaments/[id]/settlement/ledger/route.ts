import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import {
  checkClientFeatureAccessByUserId,
  getTournamentById,
  getTournamentLedgerLinesForClient,
  getUserById,
  replaceSettlementLedgerLines,
  tournamentHasActivePublishedCard,
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
    return { ok: true as const, tournament, user };
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
  const published = await tournamentHasActivePublishedCard(tournament.id);
  if (!published) {
    return { ok: false as const, status: 403, error: "게시된 대회만 정산 장부를 사용할 수 있습니다." };
  }
  return { ok: true as const, tournament, user };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const auth = await requireSettlementAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const result = await getTournamentLedgerLinesForClient(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    tournament: {
      id: result.tournament.id,
      title: result.tournament.title,
      date: result.tournament.date,
    },
    lines: result.lines,
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const auth = await requireSettlementAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { lines?: unknown } = {};
  try {
    body = (await request.json()) as { lines?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  if (!Array.isArray(body.lines)) {
    return NextResponse.json({ error: "lines 배열이 필요합니다." }, { status: 400 });
  }

  const lines: Array<{
    category: string;
    flow: string;
    amountKrw: number;
    label?: string | null;
    note?: string | null;
    entryDate?: string | null;
  }> = [];
  for (const row of body.lines) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "lines 항목 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const o = row as Record<string, unknown>;
    lines.push({
      category: typeof o.category === "string" ? o.category : "",
      flow: typeof o.flow === "string" ? o.flow : "",
      amountKrw: typeof o.amountKrw === "number" ? o.amountKrw : Number(o.amountKrw),
      label: o.label != null && typeof o.label === "string" ? o.label : null,
      note: o.note != null && typeof o.note === "string" ? o.note : null,
      entryDate: o.entryDate != null && typeof o.entryDate === "string" ? o.entryDate : null,
    });
  }

  const result = await replaceSettlementLedgerLines({ tournamentId: id, lines });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
