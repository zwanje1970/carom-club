import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function POST(request: Request) {
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

  let body: { tournamentId?: string; depositorName?: string };
  try {
    body = (await request.json()) as { tournamentId?: string; depositorName?: string };
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 }
    );
  }
  const { tournamentId, depositorName } = body;

  if (!tournamentId || !depositorName?.trim()) {
    return NextResponse.json(
      { error: "대회 선택과 입금자명이 필요합니다." },
      { status: 400 }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (tournament.status !== "OPEN") {
    return NextResponse.json({ error: "현재 모집 중인 대회가 아닙니다." }, { status: 400 });
  }

  const existing = await prisma.tournamentEntry.findUnique({
    where: {
      tournamentId_userId: { tournamentId, userId: session.id },
    },
  });
  if (existing) {
    if (existing.status === "CANCELED") {
      // 재신청 가능하도록 기존 취소 건은 업데이트할 수 있음 (또는 새로 생성 정책에 따라)
    } else {
      return NextResponse.json({ error: "이미 참가 신청하셨습니다." }, { status: 400 });
    }
  }

  const maxEntries = tournament.rule?.maxEntries ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const useWaiting = tournament.rule?.useWaiting ?? false;

  const isFull = maxEntries > 0 && confirmedCount >= maxEntries;

  try {
    if (isFull && !useWaiting) {
      return NextResponse.json(
        { error: "정원이 마감되었습니다. 참가 신청을 받지 않습니다." },
        { status: 400 }
      );
    }

    if (existing?.status === "CANCELED") {
      await prisma.tournamentEntry.delete({
        where: { id: existing.id },
      });
    }

    let waitingListOrder: number | null = null;

    if (isFull && useWaiting) {
      const lastWaiting = await prisma.tournamentEntry.findFirst({
        where: { tournamentId, status: "APPLIED" },
        orderBy: { waitingListOrder: "desc" },
      });
      waitingListOrder = (lastWaiting?.waitingListOrder ?? 0) + 1;
    }

    await prisma.tournamentEntry.create({
      data: {
        tournamentId,
        userId: session.id,
        status: "APPLIED",
        depositorName: depositorName.trim(),
        waitingListOrder,
      },
    });

    return NextResponse.json({
      ok: true,
      status: "APPLIED",
      message:
        waitingListOrder != null
          ? `대기 목록 ${waitingListOrder}번으로 등록되었습니다.`
          : "참가 신청이 접수되었습니다. 참가비 입금 후 확정됩니다.",
    });
  } catch (e) {
    console.error("apply error", e);
    return NextResponse.json(
      { error: "참가 신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
