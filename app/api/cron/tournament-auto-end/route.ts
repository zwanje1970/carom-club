import { NextResponse } from "next/server";
import { runTournamentAutoEndBatch } from "../../../../lib/server/tournament-auto-end-run";

export const runtime = "nodejs";

function resolveCronAuthSecret(): string {
  return (process.env.CRON_PUSH_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

function authorizeCronRequest(request: Request, secret: string): boolean {
  if (!secret) return false;
  if (request.headers.get("x-carom-cron-secret") === secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** 종료일 다음날 06:00(KST) 경과 대회 자동 종료 — cron 전용. */
export async function GET(request: Request) {
  const secret = resolveCronAuthSecret();
  if (!secret) {
    return NextResponse.json({ error: "CRON_PUSH_SECRET or CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorizeCronRequest(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runTournamentAutoEndBatch();
  return NextResponse.json({ ok: true, ...result });
}
