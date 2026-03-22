import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  cancelTournamentEntryWithWaitlist,
  confirmTournamentEntryPayment,
  promoteWaitingTournamentEntry,
  rejectTournamentEntryApplied,
} from "@/lib/tournament-entry-operations";

type BulkAction = "confirm" | "cancel" | "reject" | "promote_wait";

/**
 * 클라 콘솔: 참가자 일괄 처리 (순차 실행, 개별 성공/실패 반환)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { action?: string; entryIds?: string[]; rejectionReason?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = body.action as BulkAction | undefined;
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds.filter((id) => typeof id === "string") : [];
  const rejectionReason =
    typeof body.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;

  if (!action || !["confirm", "cancel", "reject", "promote_wait"].includes(action)) {
    return NextResponse.json(
      { error: "action은 confirm, cancel, reject, promote_wait 중 하나여야 합니다." },
      { status: 400 }
    );
  }
  if (entryIds.length === 0) {
    return NextResponse.json({ error: "entryIds가 필요합니다." }, { status: 400 });
  }
  if (entryIds.length > 50) {
    return NextResponse.json({ error: "한 번에 최대 50건까지 처리할 수 있습니다." }, { status: 400 });
  }

  const results: { entryId: string; ok: boolean; error?: string }[] = [];

  for (const entryId of entryIds) {
    let r:
      | { ok: true }
      | { ok: false; error: string; status: number };
    switch (action) {
      case "confirm":
        r = await confirmTournamentEntryPayment(tournamentId, entryId);
        break;
      case "cancel":
        r = await cancelTournamentEntryWithWaitlist(tournamentId, entryId);
        break;
      case "reject":
        r = await rejectTournamentEntryApplied(tournamentId, entryId, rejectionReason);
        break;
      case "promote_wait":
        r = await promoteWaitingTournamentEntry(tournamentId, entryId);
        break;
      default:
        r = { ok: false, error: "알 수 없는 action", status: 400 };
    }
    results.push({
      entryId,
      ok: r.ok,
      ...(!r.ok ? { error: r.error } : {}),
    });
  }

  return NextResponse.json({ ok: true, results });
}
