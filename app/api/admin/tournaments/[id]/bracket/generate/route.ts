import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  generateRounds,
  randomGrouping,
  fixedGrouping,
  buildBracket,
} from "@/modules/bracket-engine";
import type { BracketFormat } from "@/modules/bracket-engine/tournament-bracket";

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
  const body = await request.json().catch(() => ({}));
  const { type, groupingMode = "random" } = body as {
    type?: "carom" | "jukbang" | "survival" | "tournament";
    groupingMode?: "random" | "fixed";
  };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
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

  const rawConfig = tournament.rule?.bracketConfig;
  const config: Record<string, unknown> =
    typeof rawConfig === "string" ? (rawConfig ? JSON.parse(rawConfig) : {}) : (rawConfig ?? {});

  const gameType = (config.gameFormatMain as string) ?? tournament.rule?.bracketType ?? "carom";
  const detailFormat = (config.detailFormat as string) ?? "1v1_masters";
  const tableCount = (config.tableCount as number) ?? 6;
  const maxPerGroup = (config.maxPerGroup as number) ?? 6;
  const finalistCount = (config.finalistCount as number) ?? 3;
  const _noRematch = (config.noRematch as boolean) ?? false;
  void _noRematch; // reserved for future rematch logic
  const advancement = (config.advancementPerRound as number[]) ?? [2, 1];

  if (type === "tournament" || gameType === "tournament") {
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
    await prisma.tournamentRound.create({
      data: {
        tournamentId,
        name: "토너먼트",
        sortOrder: 0,
        bracketData: JSON.stringify(bracketData),
      },
    });
    return NextResponse.json({ ok: true, rounds: 1, message: "토너먼트 대진표가 생성되었습니다." });
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
