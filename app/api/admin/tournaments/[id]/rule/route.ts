import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";

/** 대회 규칙 저장. PUT → canManageTournament */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const {
    entryFee,
    operatingFee,
    maxEntries,
    useWaiting,
    entryConditions,
    bracketType,
    bracketConfig,
    prizeType,
    prizeInfo,
  } = body as {
    entryFee?: number | null;
    operatingFee?: number | null;
    maxEntries?: number | null;
    useWaiting?: boolean;
    entryConditions?: string | null;
    bracketType?: string | null;
    bracketConfig?: Record<string, unknown>;
    prizeType?: string | null;
    prizeInfo?: string | null;
  };

  const bracketConfigStr =
    bracketConfig !== undefined && bracketConfig !== null
      ? JSON.stringify(bracketConfig)
      : undefined;

  try {
    await prisma.tournamentRule.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        entryFee: entryFee ?? undefined,
        operatingFee: operatingFee ?? undefined,
        maxEntries: maxEntries ?? undefined,
        useWaiting: useWaiting ?? false,
        entryConditions: entryConditions ?? undefined,
        bracketType: bracketType ?? undefined,
        bracketConfig: bracketConfigStr ?? undefined,
        prizeType: prizeType ?? undefined,
        prizeInfo: prizeInfo ?? undefined,
      },
      update: {
        ...(entryFee !== undefined && { entryFee: entryFee ?? undefined }),
        ...(operatingFee !== undefined && { operatingFee: operatingFee ?? undefined }),
        ...(maxEntries !== undefined && { maxEntries: maxEntries ?? undefined }),
        ...(useWaiting !== undefined && { useWaiting }),
        ...(entryConditions !== undefined && { entryConditions: entryConditions ?? undefined }),
        ...(bracketType !== undefined && { bracketType: bracketType ?? undefined }),
        ...(bracketConfigStr !== undefined && { bracketConfig: bracketConfigStr }),
        ...(prizeType !== undefined && { prizeType: prizeType ?? undefined }),
        ...(prizeInfo !== undefined && { prizeInfo: prizeInfo ?? undefined }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("tournament rule upsert error", e);
    return NextResponse.json(
      { error: "대회 규칙 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
