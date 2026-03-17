import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import {
  generateRounds,
  randomGrouping,
  fixedGrouping,
  buildBracket,
} from "@/modules/bracket-engine";
import type { BracketFormat } from "@/modules/bracket-engine/tournament-bracket";
import { buildFinalBracketPlan, type BracketSize } from "@/lib/final-bracket";
import { sendPushToUsers } from "@/lib/push/sendPush";

/** 참가 인원 기준 다음 브래킷 크기 (2의 거듭제곱, 최대 64) */
function nextBracketSize(count: number): BracketSize {
  let size = 4;
  while (size < count && size < 64) size *= 2;
  return size as BracketSize;
}

/** Fisher–Yates shuffle (참가확정자 무작위 배치) */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 대진표 생성. POST → canManageTournament */
export async function POST(
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
    include: {
      organization: { select: ORGANIZATION_SELECT_OWNER },
      rule: true,
      entries: {
        where: { status: "CONFIRMED" },
        include: { attendances: true },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회의 대진표를 생성할 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { type, groupingMode = "random" } = body as {
    type?: "carom" | "jukbang" | "survival" | "tournament";
    groupingMode?: "random" | "fixed";
  };
  const rawConfig = tournament.rule?.bracketConfig;
  const config: Record<string, unknown> =
    typeof rawConfig === "string" ? (rawConfig ? JSON.parse(rawConfig) : {}) : (rawConfig ?? {});

  const gameType = (config.gameFormatMain as string) ?? tournament.rule?.bracketType ?? "carom";

  // 단판 토너먼트: 참가 마감(CLOSED) 후에만 생성 가능. 이미 생성된 경우 재생성 불가.
  if (type === "tournament" || gameType === "tournament") {
    if (tournament.status === "BRACKET_GENERATED") {
      return NextResponse.json(
        { error: "이미 대진표가 생성되었습니다. 참가자 수정은 할 수 없습니다." },
        { status: 400 }
      );
    }
    if (tournament.status !== "CLOSED") {
      return NextResponse.json(
        { error: "참가 마감(CLOSED) 후에만 대진표를 생성할 수 있습니다. 대회 상태를 '참가 마감'으로 변경해 주세요." },
        { status: 400 }
      );
    }
  }
  const detailFormat = (config.detailFormat as string) ?? "1v1_masters";
  const tableCount = (config.tableCount as number) ?? 6;
  const maxPerGroup = (config.maxPerGroup as number) ?? 6;
  const finalistCount = (config.finalistCount as number) ?? 3;
  const _noRematch = (config.noRematch as boolean) ?? false;
  void _noRematch; // reserved for future rematch logic
  const advancement = (config.advancementPerRound as number[]) ?? [2, 1];

  if (type === "tournament" || gameType === "tournament") {
    // 참가확정자(CONFIRMED)만 사용. 대기자(APPLIED)는 포함되지 않음.
    const entryIds = tournament.entries.map((e) => e.id);
    if (entryIds.length < 2) {
      return NextResponse.json(
        { error: "토너먼트 생성에는 최소 2명 이상의 참가 확정자가 필요합니다." },
        { status: 400 }
      );
    }
    const format = detailFormat as BracketFormat;
    const matches = buildBracket(format, entryIds);
    const bracketData = { type: "tournament", format: detailFormat, matches };

    // 본선 매치 테이블용: 2의 거듭제곱 크기, 무작위 배치 후 BYE 패딩
    const size = nextBracketSize(entryIds.length);
    const slotEntries: (string | null)[] = [...shuffle(entryIds)];
    while (slotEntries.length < size) slotEntries.push(null);
    const plan = buildFinalBracketPlan(slotEntries, size);
    const sorted = [...plan].sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);

    const createdIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      await tx.tournamentRound.create({
        data: {
          tournamentId,
          name: "토너먼트",
          sortOrder: 0,
          bracketData: JSON.stringify(bracketData),
        },
      });
      for (const p of sorted) {
        const created = await tx.tournamentFinalMatch.create({
          data: {
            tournamentId,
            roundIndex: p.roundIndex,
            matchIndex: p.matchIndex,
            entryIdA: p.entryIdA,
            entryIdB: p.entryIdB,
            status: p.status,
            nextMatchId: null,
            nextSlot: null,
          },
        });
        createdIds.push(created.id);
      }
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const nextRound = p.roundIndex + 1;
        const nextMatchIndex = Math.floor(p.matchIndex / 2);
        const nextSlot = (p.matchIndex % 2 === 0 ? "A" : "B") as "A" | "B";
        const j = sorted.findIndex((q) => q.roundIndex === nextRound && q.matchIndex === nextMatchIndex);
        if (j >= 0 && createdIds[j]) {
          await tx.tournamentFinalMatch.update({
            where: { id: createdIds[i] },
            data: { nextMatchId: createdIds[j], nextSlot },
          });
        }
      }
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "BRACKET_GENERATED" },
      });
    });

    const userIds = tournament.entries.map((e) => e.userId);
    try {
      await sendPushToUsers(userIds, {
        tournamentId,
        type: "BRACKET_GENERATED",
        title: "대진표가 생성되었습니다.",
        url: `/tournaments/${tournamentId}/bracket`,
      });
    } catch {
      // push 실패해도 대진 생성은 완료된 것으로 처리
    }
    return NextResponse.json({
      ok: true,
      rounds: 1,
      matchCount: sorted.length,
      size,
      message: "토너먼트 대진표가 생성되었습니다. 참가확정자 기준이며, 관리 화면에서 수동 배치 가능합니다.",
    });
  }

  // 캐롬/서바이벌: 출석한 참가자만
  const attendedEntries = tournament.entries.filter((e) => {
    const att = e.attendances[0];
    return att?.attended === true;
  });
  const participantIds = attendedEntries.map((e) => e.id);

  if (participantIds.length < 3) {
    return NextResponse.json(
      { error: "캐롬/서바이벌은 출석 체크된 참가자 최소 3명이 필요합니다." },
      { status: 400 }
    );
  }

  const plans = generateRounds({
    participantCount: participantIds.length,
    advancementPerRound: advancement,
    finalistCount,
    tableCount,
    constraints: { minPerGroup: 3, maxPerGroup: maxPerGroup || 6, maxGroupSizeDiff: 1 },
  });

  if (plans.length === 0) {
    return NextResponse.json(
      { error: "조편성 조건을 만족할 수 없습니다. 테이블 수 또는 참가 인원을 확인하세요." },
      { status: 400 }
    );
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let r = 0; r < plans.length; r++) {
    const plan = plans[r];
    const round = await prisma.tournamentRound.create({
      data: {
        tournamentId,
        name: r === 0 ? "1라운드" : r === 1 ? "2라운드" : `${r + 1}라운드`,
        sortOrder: r,
        bracketData: JSON.stringify({
          groupSizes: plan.groupSizes,
          advancePerGroup: plan.advancePerGroup,
          participantCount: plan.participantCount,
        }),
      },
    });

    if (r === 0) {
      const assignment =
        groupingMode === "fixed"
          ? fixedGrouping(participantIds, plan.groupSizes)
          : randomGrouping(participantIds, plan.groupSizes);
      for (let g = 0; g < assignment.length; g++) {
        const tournamentGroup = await prisma.tournamentGroup.create({
          data: {
            roundId: round.id,
            name: `${letters[g]}조`,
            sortOrder: g,
          },
        });
        const entryIdsInGroup = assignment[g];
        for (let i = 0; i < entryIdsInGroup.length; i++) {
          await prisma.tournamentGroupMember.create({
            data: {
              groupId: tournamentGroup.id,
              entryId: entryIdsInGroup[i],
              sortOrder: i,
            },
          });
        }
      }
    } else {
      for (let g = 0; g < plan.groupSizes.length; g++) {
        await prisma.tournamentGroup.create({
          data: {
            roundId: round.id,
            name: `${letters[g]}조`,
            sortOrder: g,
          },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rounds: plans.length,
    message: "대진표가 생성되었습니다.",
  });
}
