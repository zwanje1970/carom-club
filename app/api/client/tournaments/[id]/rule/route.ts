import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 클라 콘솔: 대회 규칙(bracketConfig 등) 저장 */
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
    bracketConfig !== undefined && bracketConfig !== null ? JSON.stringify(bracketConfig) : undefined;

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
    console.error("[client/tournaments/rule PUT]", e);
    return NextResponse.json({ error: "대회 규칙 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
