import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  settlementApiCheckClientFeatureAccess,
  settlementApiGetSessionUser,
} from "../../../../../../lib/server/settlement-api-auth-firestore";
import {
  deleteSettlementExpenseItemFirestore,
  getSettlementSummaryByTournamentIdFirestore,
  getTournamentSettlementByTournamentIdFirestore,
  setSettlementRefundedFirestore,
  setTournamentSettlementStatusFirestore,
  upsertSettlementExpenseItemFirestore,
} from "../../../../../../lib/server/firestore-tournament-settlements";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

async function requireSettlementAccess(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await settlementApiGetSessionUser(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };

  if (user.role === "PLATFORM") {
    return { ok: true as const, tournament, user };
  }
  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await settlementApiCheckClientFeatureAccess({ userId: user.id, feature: "SETTLEMENT" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }
  if (tournament.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }
  return { ok: true as const, tournament, user };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const auth = await requireSettlementAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const summaryResult = await getSettlementSummaryByTournamentIdFirestore(id);
  if (!summaryResult.ok) {
    return NextResponse.json({ error: summaryResult.error }, { status: 400 });
  }
  const settlementResult = await getTournamentSettlementByTournamentIdFirestore(id);
  if (!settlementResult.ok) {
    return NextResponse.json({ error: settlementResult.error }, { status: 400 });
  }

  return NextResponse.json({
    tournament: {
      id: auth.tournament.id,
      title: auth.tournament.title,
    },
    summary: summaryResult.summary,
    settlement: settlementResult.settlement,
  });
}

type SettlementPatchRequest =
  | { action?: "addExpense"; title?: string; amount?: number }
  | { action?: "updateExpense"; expenseItemId?: string; title?: string; amount?: number }
  | { action?: "deleteExpense"; expenseItemId?: string }
  | { action?: "toggleRefund"; applicationId?: string; refunded?: boolean }
  | { action?: "setSettled"; isSettled?: boolean };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const auth = await requireSettlementAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as SettlementPatchRequest | null;
  const action = body?.action;
  if (!action) {
    return NextResponse.json({ error: "action이 필요합니다." }, { status: 400 });
  }

  let result: { ok: true; settlement: unknown } | { ok: false; error: string };

  if (action === "addExpense") {
    result = await upsertSettlementExpenseItemFirestore({
      tournamentId: id,
      title: typeof body.title === "string" ? body.title : "",
      amount: typeof body.amount === "number" ? body.amount : Number(body.amount),
      actorUserId: auth.user.id,
    });
  } else if (action === "updateExpense") {
    result = await upsertSettlementExpenseItemFirestore({
      tournamentId: id,
      expenseItemId: typeof body.expenseItemId === "string" ? body.expenseItemId : "",
      title: typeof body.title === "string" ? body.title : "",
      amount: typeof body.amount === "number" ? body.amount : Number(body.amount),
      actorUserId: auth.user.id,
    });
  } else if (action === "deleteExpense") {
    result = await deleteSettlementExpenseItemFirestore({
      tournamentId: id,
      expenseItemId: typeof body.expenseItemId === "string" ? body.expenseItemId : "",
    });
  } else if (action === "toggleRefund") {
    result = await setSettlementRefundedFirestore({
      tournamentId: id,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : "",
      refunded: Boolean(body.refunded),
    });
  } else if (action === "setSettled") {
    result = await setTournamentSettlementStatusFirestore({
      tournamentId: id,
      isSettled: Boolean(body.isSettled),
    });
  } else {
    return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const summaryResult = await getSettlementSummaryByTournamentIdFirestore(id);
  if (!summaryResult.ok) {
    return NextResponse.json({ error: summaryResult.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    settlement: result.settlement,
    summary: summaryResult.summary,
  });
}
