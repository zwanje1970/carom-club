import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientActiveOrgCanMutateTournaments } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { sendPushToUsers } from "@/lib/push/sendPush";

type RequestBody = {
  selectedUserIds?: string[];
  selectedTournamentIds?: string[];
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  const session = await getSession();
  const gate = await assertClientActiveOrgCanMutateTournaments(session);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const selectedUserIds = Array.isArray(body.selectedUserIds)
    ? [...new Set(body.selectedUserIds.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const selectedTournamentIds = Array.isArray(body.selectedTournamentIds)
    ? [...new Set(body.selectedTournamentIds.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (selectedUserIds.length === 0) {
    return NextResponse.json({ error: "발송 대상을 선택해 주세요." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  if (title.length > 80) {
    return NextResponse.json({ error: "제목은 80자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (message.length > 200) {
    return NextResponse.json({ error: "내용은 200자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (url && !url.startsWith("/")) {
    return NextResponse.json({ error: "이동 경로는 '/' 로 시작하는 내부 경로만 허용됩니다." }, { status: 400 });
  }
  if (url.length > 300) {
    return NextResponse.json({ error: "이동 경로가 너무 깁니다." }, { status: 400 });
  }

  const ownedTournaments = await prisma.tournament.findMany({
    where: { organizationId: gate.organizationId },
    select: { id: true },
  });
  const ownedTournamentIds = new Set(ownedTournaments.map((tournament) => tournament.id));
  if (selectedTournamentIds.some((id) => !ownedTournamentIds.has(id))) {
    return NextResponse.json({ error: "현재 조직 소유 대회만 발송 대상으로 사용할 수 있습니다." }, { status: 403 });
  }
  const targetTournamentIds =
    selectedTournamentIds.length > 0 ? selectedTournamentIds : [...ownedTournamentIds];
  if (targetTournamentIds.length === 0) {
    return NextResponse.json({ error: "발송 가능한 대회가 없습니다." }, { status: 400 });
  }

  const eligibleEntries = await prisma.tournamentEntry.findMany({
    where: {
      userId: { in: selectedUserIds },
      tournamentId: { in: targetTournamentIds },
      tournament: {
        organizationId: gate.organizationId,
      },
    },
    select: {
      userId: true,
      tournamentId: true,
    },
  });

  const eligibleUserIds = [...new Set(eligibleEntries.map((entry) => entry.userId))];
  if (eligibleUserIds.length === 0) {
    return NextResponse.json({ error: "현재 조직 소유 대회 참가자만 발송할 수 있습니다." }, { status: 400 });
  }

  const eligibleTournamentIds = [...new Set(eligibleEntries.map((entry) => entry.tournamentId))];
  const result = await sendPushToUsers(eligibleUserIds, {
    type: "CLIENT_CUSTOM",
    title,
    body: message,
    url: url || "/client/operations/push",
    tournamentId: targetTournamentIds.length === 1 ? targetTournamentIds[0] : null,
  });

  return NextResponse.json({
    ok: true,
    audienceCount: eligibleUserIds.length,
    tournamentCount: eligibleTournamentIds.length,
    sent: result.sent,
    failed: result.failed,
  });
}
