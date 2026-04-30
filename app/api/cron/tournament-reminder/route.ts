import { NextResponse } from "next/server";
import {
  calendarTodayYyyyMmDdSeoul,
  isAutoParticipantPushEnabledForClientUserId,
} from "../../../../lib/server/platform-backing-store";
import {
  listAllTournamentsFirestore,
  setTournamentReminderSentAtFirestore,
} from "../../../../lib/server/firestore-tournaments";
import { listTournamentApplicationsByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-applications";
import {
  addDaysYyyyMmDd,
  clampAutoPushBody,
  truncateTournamentNameForAutoPush,
} from "../../../../lib/server/tournament-auto-push-text";

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

function internalDeploymentOrigin(): string {
  const vu = process.env.VERCEL_URL?.trim();
  if (vu) return `https://${vu}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (base) return base;
  return "http://127.0.0.1:3000";
}

export async function GET(request: Request) {
  const secret = resolveCronAuthSecret();
  if (!secret) {
    return NextResponse.json({ error: "CRON_PUSH_SECRET or CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorizeCronRequest(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = calendarTodayYyyyMmDdSeoul();
  const tomorrow = addDaysYyyyMmDd(today, 1);
  if (!tomorrow) {
    return NextResponse.json({ error: "날짜 계산 실패" }, { status: 500 });
  }

  const tournaments = await listAllTournamentsFirestore();
  const candidates = tournaments.filter((t) => {
    if (t.status === "DELETED") return false;
    if (typeof t.reminderSentAt === "string" && t.reminderSentAt.trim() !== "") return false;
    const gt = typeof t.gatheringTime === "string" ? t.gatheringTime.trim() : "";
    if (!gt) return false;
    const d = typeof t.date === "string" ? t.date.trim() : "";
    return d === tomorrow;
  });

  const baseUrl = internalDeploymentOrigin();
  let sent = 0;
  let skippedNoRecipients = 0;
  let pushFailed = 0;

  for (const t of candidates) {
    const apps = await listTournamentApplicationsByTournamentIdFirestore(t.id);
    const approved = apps.filter((a) => a.status === "APPROVED");
    const userIds = [...new Set(approved.map((a) => String(a.userId ?? "").trim()).filter(Boolean))];
    if (userIds.length === 0) {
      skippedNoRecipients += 1;
      continue;
    }

    const creator = String(t.createdBy ?? "").trim();
    if (!creator) {
      pushFailed += 1;
      continue;
    }
    if (!(await isAutoParticipantPushEnabledForClientUserId(creator))) {
      continue;
    }

    const name = truncateTournamentNameForAutoPush(t.title);
    const gt = (t.gatheringTime ?? "").trim();
    const bodyText = clampAutoPushBody(`${name}, ${gt}까지 도착해주세요.`, 60);

    const res = await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-carom-cron-secret": secret,
      },
      body: JSON.stringify({
        title: "내일 대회 안내",
        body: bodyText,
        targetUserIds: userIds,
        internalCreatorUserId: creator,
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || payload.ok !== true) {
      console.error("[cron/tournament-reminder] push/send failed", t.id, res.status, payload.error ?? "");
      pushFailed += 1;
      continue;
    }

    await setTournamentReminderSentAtFirestore(t.id);
    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    tomorrow,
    candidateCount: candidates.length,
    reminderSent: sent,
    skippedNoRecipients,
    pushFailed,
  });
}
