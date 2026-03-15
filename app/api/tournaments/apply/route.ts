import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

function parseAllowMultipleSlots(rule: { bracketConfig?: string | object | null } | null): boolean {
  if (!rule?.bracketConfig) return false;
  try {
    const raw =
      typeof rule.bracketConfig === "string" ? JSON.parse(rule.bracketConfig) : rule.bracketConfig;
    const c = raw as Record<string, unknown>;
    return c.allowMultipleSlots === true;
  } catch {
    return false;
  }
}

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

  let body: { tournamentId?: string; depositorName?: string; clubOrAffiliation?: string; additionalSlot?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 }
    );
  }
  const { tournamentId, depositorName, clubOrAffiliation, additionalSlot } = body;
  const club = typeof clubOrAffiliation === "string" ? clubOrAffiliation.trim() || null : null;

  if (!tournamentId || !depositorName?.trim()) {
    return NextResponse.json(
      { error: "대회 선택과 입금자명이 필요합니다." },
      { status: 400 }
    );
  }

  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없거나 비공개 대회입니다." }, { status: 404 });
  }
  if (tournament.status === "FINISHED") {
    return NextResponse.json({ error: "종료된 대회에는 참가 신청할 수 없습니다." }, { status: 400 });
  }
  if (tournament.status === "CLOSED") {
    return NextResponse.json({ error: "참가 신청이 마감되었습니다." }, { status: 400 });
  }
  if (tournament.status === "DRAFT") {
    return NextResponse.json({ error: "아직 참가 신청을 받지 않습니다. 운영자 안내를 기다려 주세요." }, { status: 400 });
  }
  if (tournament.status !== "OPEN") {
    return NextResponse.json({ error: "현재 모집 중이 아닙니다. 참가 신청을 받지 않습니다." }, { status: 400 });
  }

  const tournamentWithRule = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournamentWithRule) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const allowMultipleSlots = parseAllowMultipleSlots(tournamentWithRule.rule);
  const baseEntryFee = tournamentWithRule.rule?.entryFee ?? tournamentWithRule.entryFee ?? 0;

  const existingEntries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, userId: session.id },
    select: { id: true, status: true, slotNumber: true },
    orderBy: { slotNumber: "asc" },
  });

  const nonCanceled = existingEntries.filter((e) => e.status !== "CANCELED");
  const maxSlot = existingEntries.length > 0 ? Math.max(...existingEntries.map((e) => e.slotNumber)) : 0;
  const nextSlotNumber = maxSlot + 1;

  if (!allowMultipleSlots) {
    if (nonCanceled.length > 0) {
      return NextResponse.json({ error: "이미 참가 신청하셨습니다. 이 대회는 중복 참가를 허용하지 않습니다." }, { status: 400 });
    }
    const canceled = existingEntries.find((e) => e.status === "CANCELED");
    if (canceled) {
      await prisma.tournamentEntry.delete({ where: { id: canceled.id } });
    }
  } else {
    if (additionalSlot && nonCanceled.length === 0) {
      return NextResponse.json({ error: "먼저 1슬롯 참가 신청을 완료한 후 추가 슬롯을 신청할 수 있습니다." }, { status: 400 });
    }
    if (!additionalSlot && nonCanceled.length > 0) {
      return NextResponse.json(
        { error: "이미 참가 신청하셨습니다. 추가 슬롯을 원하시면 '추가 슬롯 신청 (참가비 2배)'을 이용해 주세요." },
        { status: 400 }
      );
    }
  }

  const maxEntries = tournamentWithRule.rule?.maxEntries ?? tournamentWithRule.maxParticipants ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const useWaiting = tournamentWithRule.rule?.useWaiting ?? false;
  const isFull = maxEntries > 0 && confirmedCount >= maxEntries;

  try {
    if (isFull && !useWaiting) {
      return NextResponse.json(
        { error: "정원이 마감되었습니다. 참가 신청을 받지 않습니다." },
        { status: 400 }
      );
    }

    const isAdditionalSlot = allowMultipleSlots && nextSlotNumber >= 2;
    const entryFeeAmount = isAdditionalSlot ? baseEntryFee * 2 : baseEntryFee;

    await prisma.tournamentEntry.create({
      data: {
        tournamentId,
        userId: session.id,
        slotNumber: nextSlotNumber,
        status: "APPLIED",
        depositorName: depositorName.trim(),
        clubOrAffiliation: club,
        entryFeeAmount: baseEntryFee > 0 ? entryFeeAmount : null,
      },
    });

    const feeMessage =
      nextSlotNumber === 1
        ? baseEntryFee > 0
          ? `참가비 ${baseEntryFee.toLocaleString()}원`
          : ""
        : baseEntryFee > 0
          ? `추가 슬롯 참가비 ${(baseEntryFee * 2).toLocaleString()}원 (2배)`
          : "";

    return NextResponse.json({
      ok: true,
      status: "APPLIED",
      slotNumber: nextSlotNumber,
      message: nextSlotNumber >= 2
        ? `추가 슬롯(슬롯${nextSlotNumber}) 신청이 접수되었습니다. ${feeMessage} 입금 후 '입금 완료'를 체크해 주세요.`
        : "참가 신청이 접수되었습니다. 입금 후 아래에서 '입금 완료'를 체크해 주세요. 관리자 입금확인 순으로 참가가 확정됩니다.",
    });
  } catch (e) {
    console.error("apply error", e);
    return NextResponse.json(
      { error: "참가 신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
