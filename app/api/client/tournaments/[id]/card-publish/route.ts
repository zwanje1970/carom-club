import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  buildDefaultTournamentCardPublishData,
  parseTournamentCardPublishState,
  upsertTournamentCardPublishState,
  type TournamentCardPublishData,
} from "@/lib/client-card-publish";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      rule: { select: { id: true, bracketConfig: true } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const state = parseTournamentCardPublishState(
    tournament.rule?.bracketConfig ?? null,
    tournament.id,
    tournament.name
  );
  const initial = state.draft ?? state.published ?? buildDefaultTournamentCardPublishData(tournament.id, tournament.name);

  return NextResponse.json({
    tournamentId: tournament.id,
    cardData: initial,
    published: state.published,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      rule: { select: { id: true, bracketConfig: true } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { action?: "saveDraft" | "publish" | "save"; cardData?: TournamentCardPublishData }
    | null;
  const actionRaw = body?.action;
  const payload = body?.cardData;
  if (!actionRaw || !payload) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const action = actionRaw === "save" ? "saveDraft" : actionRaw;
  if (action !== "saveDraft" && action !== "publish") {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (payload.tournamentId !== tournament.id) {
    return NextResponse.json({ error: "대회 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (payload.templateType !== "basic" && payload.templateType !== "highlight") {
    return NextResponse.json({ error: "템플릿 유형이 올바르지 않습니다." }, { status: 400 });
  }
  if (action === "publish") {
    const requiredFields: Array<[string, string]> = [
      [payload.cardTitle, "카드 제목"],
      [payload.displayDateText, "날짜 텍스트"],
      [payload.displayRegionText, "지역 텍스트"],
      [payload.statusText, "상태 텍스트"],
      [payload.buttonText, "버튼 텍스트"],
    ];
    const missing = requiredFields.find(([value]) => !String(value ?? "").trim());
    if (missing) {
      return NextResponse.json(
        { error: `필수 항목(${missing[1]})을 입력해 주세요.` },
        { status: 400 }
      );
    }
  }

  const nextData: TournamentCardPublishData = {
    ...payload,
    shortDescription: payload.shortDescription ?? "",
    isPublished: action === "publish",
    updatedAt: new Date().toISOString(),
  };

  const current = parseTournamentCardPublishState(
    tournament.rule?.bracketConfig ?? null,
    tournament.id,
    tournament.name
  );
  const nextState =
    action === "publish"
      ? { draft: nextData, published: nextData }
      : { draft: nextData, published: current.published };
  const nextConfig = upsertTournamentCardPublishState(tournament.rule?.bracketConfig ?? null, nextState);

  if (tournament.rule?.id) {
    await prisma.tournamentRule.update({
      where: { id: tournament.rule.id },
      data: { bracketConfig: nextConfig },
    });
  } else {
    await prisma.tournamentRule.create({
      data: {
        tournamentId: tournament.id,
        bracketConfig: nextConfig,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    cardData: nextData,
    published: nextState.published,
  });
}
