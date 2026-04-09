import type { Prisma, PrismaClient, BracketMatch, Bracket } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { buildFinalBracketPlan } from "@/lib/final-bracket";
import type { FinalMatchCreate } from "@/lib/final-bracket";
import type { ZoneBracketPlan } from "@/lib/zone-bracket";

export type BracketDb = PrismaClient | Prisma.TransactionClient;

function buildBracketWhere(
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  zoneId?: string | null
) {
  return zoneId ? { tournamentId, kind, zoneId } : { tournamentId, kind };
}

export type BracketMatchView = {
  id: string;
  tournamentRoundId: string | null;
  matchVenueId: string | null;
  bracketPhase: string;
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  entryALabel: string | null;
  entryBLabel: string | null;
  divisionA: string | null;
  divisionB: string | null;
  venueLabel: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerEntryId: string | null;
  status: string;
  nextMatchId: string | null;
  nextSlot: "A" | "B" | null;
  scheduledStartAt: string | null;
  hasIssue: boolean;
  issueNote: string | null;
};

export function sortBracketPlan(plan: FinalMatchCreate[]): FinalMatchCreate[] {
  return [...plan].sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
}

async function ensureBracket(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  zoneId: string | null = null,
  opts?: { seedingMode?: "RANDOM" | "LEVEL_BASED" | "MANUAL"; byeStrategy?: "EARLY" | "ROUND_BASED" }
): Promise<Bracket> {
  const found = await db.bracket.findFirst({ where: { tournamentId, kind, zoneId } });
  if (found) return found;
  return db.bracket.create({
    data: {
      tournamentId,
      zoneId,
      kind,
      status: "GENERATED",
      seedingMode: opts?.seedingMode ?? "RANDOM",
      byeStrategy: opts?.byeStrategy ?? "EARLY",
      generatedAt: new Date(),
    },
  });
}

function deriveRoundName(roundIndex: number): string {
  return roundIndex === 0 ? "1라운드" : `${roundIndex + 1}라운드`;
}

export async function createMainBracketMatchesFromPlan(
  tx: BracketDb,
  args: {
    tournamentId: string;
    sortedPlan: FinalMatchCreate[];
    matchVenueIdsInOrder?: string[];
    seedingMode?: "RANDOM" | "LEVEL_BASED" | "MANUAL";
    byeStrategy?: "EARLY" | "ROUND_BASED";
  }
): Promise<{ bracketId: string; matchIds: string[] }> {
  const bracket = await ensureBracket(tx, args.tournamentId, "MAIN", null, {
    seedingMode: args.seedingMode,
    byeStrategy: args.byeStrategy,
  });
  const matchVenueIds = args.matchVenueIdsInOrder?.length ? args.matchVenueIdsInOrder : null;
  const rounds = Array.from(new Set(args.sortedPlan.map((p) => p.roundIndex))).sort((a, b) => a - b);
  const roundIdByNumber = new Map<number, string>();

  for (const roundNumber of rounds) {
    const targetSize = args.sortedPlan.filter((p) => p.roundIndex === roundNumber).length;
    const round = await tx.bracketRound.create({
      data: {
        bracketId: bracket.id,
        matchDayId: null,
        roundNumber,
        name: deriveRoundName(roundNumber),
        targetSize,
        sortOrder: roundNumber,
      },
    });
    roundIdByNumber.set(roundNumber, round.id);
  }

  const created: { id: string; roundNumber: number; matchNumber: number }[] = [];
  for (let i = 0; i < args.sortedPlan.length; i++) {
    const p = args.sortedPlan[i]!;
    const roundId = roundIdByNumber.get(p.roundIndex);
    if (!roundId) continue;
    const venueId = matchVenueIds ? matchVenueIds[i % matchVenueIds.length] ?? null : null;
    const row = await tx.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        roundId,
        venueId,
        matchNumber: p.matchIndex,
        tableOrder: null,
        displayOrder: null,
        entryIdA: p.entryIdA,
        entryIdB: p.entryIdB,
        winnerEntryId: null,
        scoreA: null,
        scoreB: null,
        status: p.status === "BYE" ? "READY" : "PENDING",
        isBye: p.status === "BYE",
        isReduction: false,
        isManualOverride: false,
        nextMatchId: null,
        nextSlot: null,
        scheduledStartAt: null,
        hasIssue: false,
        issueNote: null,
        startedAt: null,
        completedAt: null,
        note: null,
      },
    });
    created.push({ id: row.id, roundNumber: p.roundIndex, matchNumber: p.matchIndex });
  }

  const matchIds = created.map((m) => m.id);
  for (const current of created) {
    const nr = current.roundNumber + 1;
    const nm = Math.floor(current.matchNumber / 2);
    const nextSlot = current.matchNumber % 2 === 0 ? "A" : "B";
    const next = created.find((m) => m.roundNumber === nr && m.matchNumber === nm);
    if (next) {
      await tx.bracketMatch.update({
        where: { id: current.id },
        data: { nextMatchId: next.id, nextSlot },
      });
    }
  }

  return { bracketId: bracket.id, matchIds };
}

export async function fetchMainBracketSnapshot(tournamentId: string) {
  const bracket = await prisma.bracket.findFirst({
    where: { tournamentId, kind: "MAIN" },
    include: {
      rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { orderBy: { matchNumber: "asc" } } } },
      matches: { orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }] },
    },
  });
  return bracket;
}

export async function fetchBracketSnapshotByKind(tournamentId: string, kind: "MAIN" | "ZONE" | "FINAL") {
  return prisma.bracket.findFirst({
    where: { tournamentId, kind },
    include: {
      rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { orderBy: { matchNumber: "asc" } } } },
      matches: { orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }] },
    },
  });
}

function normalizeLegacyBracketStatus(
  status: string | null | undefined
): "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "READY") return "READY";
  if (status === "CANCELLED") return "CANCELLED";
  return "PENDING";
}

async function materializeLegacyFinalMatchesAsBracket(
  tx: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "FINAL"
): Promise<void> {
  const [tournament, legacyMatches] = await Promise.all([
    tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { seedingMode: true, byeStrategy: true },
    }),
    tx.tournamentFinalMatch.findMany({
      where: { tournamentId },
      orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
    }),
  ]);
  if (!legacyMatches.length) return;

  const bracket = await tx.bracket.create({
    data: {
      tournamentId,
      zoneId: null,
      kind,
      status: "GENERATED",
      seedingMode: (tournament?.seedingMode as "RANDOM" | "LEVEL_BASED" | "MANUAL" | null) ?? "RANDOM",
      byeStrategy: (tournament?.byeStrategy as "EARLY" | "ROUND_BASED" | null) ?? "EARLY",
      generatedAt: new Date(),
    },
  });

  const roundNumbers = Array.from(new Set(legacyMatches.map((m) => m.roundIndex))).sort((a, b) => a - b);
  const roundIdByNumber = new Map<number, string>();
  for (const roundNumber of roundNumbers) {
    const round = await tx.bracketRound.create({
      data: {
        bracketId: bracket.id,
        matchDayId: null,
        roundNumber,
        name: deriveRoundName(roundNumber),
        targetSize: legacyMatches.filter((m) => m.roundIndex === roundNumber).length,
        sortOrder: roundNumber,
      },
    });
    roundIdByNumber.set(roundNumber, round.id);
  }

  const idMap = new Map<string, string>();
  for (const legacy of legacyMatches) {
    const roundId = roundIdByNumber.get(legacy.roundIndex);
    if (!roundId) continue;
    const created = await tx.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        roundId,
        venueId: legacy.matchVenueId,
        matchNumber: legacy.matchIndex,
        tableOrder: null,
        displayOrder: null,
        entryIdA: legacy.entryIdA,
        entryIdB: legacy.entryIdB,
        winnerEntryId: legacy.winnerEntryId,
        scoreA: legacy.scoreA,
        scoreB: legacy.scoreB,
        status: normalizeLegacyBracketStatus(legacy.status),
        isBye: legacy.status === "BYE",
        isReduction: false,
        isManualOverride: false,
        nextMatchId: null,
        nextSlot: legacy.nextSlot as "A" | "B" | null,
        scheduledStartAt: legacy.scheduledStartAt ?? null,
        hasIssue: legacy.hasIssue ?? false,
        issueNote: legacy.issueNote ?? null,
        startedAt: null,
        completedAt: legacy.status === "COMPLETED" ? legacy.updatedAt : null,
        note: null,
      },
    });
    idMap.set(legacy.id, created.id);
  }

  for (const legacy of legacyMatches) {
    if (!legacy.nextMatchId) continue;
    const newId = idMap.get(legacy.id);
    const nextId = idMap.get(legacy.nextMatchId);
    if (!newId || !nextId) continue;
    await tx.bracketMatch.update({
      where: { id: newId },
      data: { nextMatchId: nextId, nextSlot: legacy.nextSlot as "A" | "B" | null },
    });
  }
}

export async function fetchOrImportBracketSnapshotByKind(tournamentId: string, kind: "MAIN" | "ZONE" | "FINAL") {
  const existing = await fetchBracketSnapshotByKind(tournamentId, kind);
  if (existing) return existing;
  if (kind === "ZONE") return null;
  const legacyCount = await prisma.tournamentFinalMatch.count({ where: { tournamentId } });
  if (!legacyCount) return null;
  await prisma.$transaction(async (tx) => {
    await materializeLegacyFinalMatchesAsBracket(tx, tournamentId, kind);
  });
  return fetchBracketSnapshotByKind(tournamentId, kind);
}

async function materializeLegacyZoneMatchesAsBracket(
  tx: BracketDb,
  tournamentId: string,
  tournamentZoneId: string
): Promise<void> {
  const [zone, legacyMatches] = await Promise.all([
    tx.tournamentZone.findUnique({
      where: { id: tournamentZoneId },
      select: { id: true, qualifierTarget: true },
    }),
    tx.tournamentZoneMatch.findMany({
      where: { tournamentZoneId },
      orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
    }),
  ]);
  if (!zone || !legacyMatches.length) return;

  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { seedingMode: true, byeStrategy: true },
  });
  const bracket = await tx.bracket.create({
    data: {
      tournamentId,
      zoneId: zone.id,
      kind: "ZONE",
      status: "GENERATED",
      seedingMode: (tournament?.seedingMode as "RANDOM" | "LEVEL_BASED" | "MANUAL" | null) ?? "RANDOM",
      byeStrategy: (tournament?.byeStrategy as "EARLY" | "ROUND_BASED" | null) ?? "EARLY",
      generatedAt: new Date(),
    },
  });

  const roundNumbers = Array.from(new Set(legacyMatches.map((m) => m.roundIndex))).sort((a, b) => a - b);
  const roundIdByNumber = new Map<number, string>();
  for (const roundNumber of roundNumbers) {
    const round = await tx.bracketRound.create({
      data: {
        bracketId: bracket.id,
        matchDayId: null,
        roundNumber,
        name: deriveRoundName(roundNumber),
        targetSize: legacyMatches.filter((m) => m.roundIndex === roundNumber).length,
        sortOrder: roundNumber,
      },
    });
    roundIdByNumber.set(roundNumber, round.id);
  }

  const idMap = new Map<string, string>();
  for (const legacy of legacyMatches) {
    const roundId = roundIdByNumber.get(legacy.roundIndex);
    if (!roundId) continue;
    const created = await tx.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        roundId,
        venueId: null,
        matchNumber: legacy.matchIndex,
        tableOrder: null,
        displayOrder: null,
        entryIdA: legacy.entryIdA,
        entryIdB: legacy.entryIdB,
        winnerEntryId: legacy.winnerEntryId,
        scoreA: legacy.scoreA,
        scoreB: legacy.scoreB,
        status: normalizeLegacyBracketStatus(legacy.status),
        isBye: legacy.status === "BYE",
        isReduction: false,
        isManualOverride: false,
        nextMatchId: null,
        nextSlot: legacy.nextSlot as "A" | "B" | null,
        scheduledStartAt: null,
        hasIssue: false,
        issueNote: null,
        startedAt: null,
        completedAt: legacy.status === "COMPLETED" ? legacy.updatedAt : null,
        note: null,
      },
    });
    idMap.set(legacy.id, created.id);
  }

  for (const legacy of legacyMatches) {
    if (!legacy.nextMatchId) continue;
    const newId = idMap.get(legacy.id);
    const nextId = idMap.get(legacy.nextMatchId);
    if (!newId || !nextId) continue;
    await tx.bracketMatch.update({
      where: { id: newId },
      data: { nextMatchId: nextId, nextSlot: legacy.nextSlot as "A" | "B" | null },
    });
  }
}

export async function fetchOrImportZoneBracketSnapshotByZoneId(
  tournamentId: string,
  tournamentZoneId: string
) {
  const existing = await prisma.bracket.findFirst({
    where: { tournamentId, zoneId: tournamentZoneId, kind: "ZONE" },
    include: {
      rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { orderBy: { matchNumber: "asc" } } } },
      matches: { orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }] },
    },
  });
  if (existing) return existing;
  const legacyCount = await prisma.tournamentZoneMatch.count({ where: { tournamentZoneId } });
  if (!legacyCount) return null;
  await prisma.$transaction(async (tx) => {
    await materializeLegacyZoneMatchesAsBracket(tx, tournamentId, tournamentZoneId);
  });
  return prisma.bracket.findFirst({
    where: { tournamentId, zoneId: tournamentZoneId, kind: "ZONE" },
    include: {
      rounds: { orderBy: { roundNumber: "asc" }, include: { matches: { orderBy: { matchNumber: "asc" } } } },
      matches: { orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }] },
    },
  });
}

export async function createBracketMatchesFromPlanByKind(
  tx: BracketDb,
  args: {
    tournamentId: string;
    kind: "MAIN" | "ZONE" | "FINAL";
    zoneId?: string | null;
    sortedPlan: FinalMatchCreate[];
    matchVenueIdsInOrder?: string[];
    seedingMode?: "RANDOM" | "LEVEL_BASED" | "MANUAL";
    byeStrategy?: "EARLY" | "ROUND_BASED";
  }
): Promise<{ bracketId: string; matchIds: string[] }> {
  const bracket = await ensureBracket(tx, args.tournamentId, args.kind, args.zoneId ?? null, {
    seedingMode: args.seedingMode,
    byeStrategy: args.byeStrategy,
  });
  const matchVenueIds = args.matchVenueIdsInOrder?.length ? args.matchVenueIdsInOrder : null;
  const rounds = Array.from(new Set(args.sortedPlan.map((p) => p.roundIndex))).sort((a, b) => a - b);
  const roundIdByNumber = new Map<number, string>();

  for (const roundNumber of rounds) {
    const targetSize = args.sortedPlan.filter((p) => p.roundIndex === roundNumber).length;
    const round = await tx.bracketRound.create({
      data: {
        bracketId: bracket.id,
        matchDayId: null,
        roundNumber,
        name: deriveRoundName(roundNumber),
        targetSize,
        sortOrder: roundNumber,
      },
    });
    roundIdByNumber.set(roundNumber, round.id);
  }

  const created: { id: string; roundNumber: number; matchNumber: number }[] = [];
  for (let i = 0; i < args.sortedPlan.length; i++) {
    const p = args.sortedPlan[i]!;
    const roundId = roundIdByNumber.get(p.roundIndex);
    if (!roundId) continue;
    const venueId = matchVenueIds ? matchVenueIds[i % matchVenueIds.length] ?? null : null;
    const row = await tx.bracketMatch.create({
      data: {
        bracketId: bracket.id,
        roundId,
        venueId,
        matchNumber: p.matchIndex,
        tableOrder: null,
        displayOrder: null,
        entryIdA: p.entryIdA,
        entryIdB: p.entryIdB,
        winnerEntryId: null,
        scoreA: null,
        scoreB: null,
        status: p.status === "BYE" ? "READY" : "PENDING",
        isBye: p.status === "BYE",
        isReduction: false,
        isManualOverride: false,
        nextMatchId: null,
        nextSlot: null,
        scheduledStartAt: null,
        hasIssue: false,
        issueNote: null,
        startedAt: null,
        completedAt: null,
        note: null,
      },
    });
    created.push({ id: row.id, roundNumber: p.roundIndex, matchNumber: p.matchIndex });
  }

  const matchIds = created.map((m) => m.id);
  for (const current of created) {
    const nr = current.roundNumber + 1;
    const nm = Math.floor(current.matchNumber / 2);
    const nextSlot = current.matchNumber % 2 === 0 ? "A" : "B";
    const next = created.find((m) => m.roundNumber === nr && m.matchNumber === nm);
    if (next) {
      await tx.bracketMatch.update({
        where: { id: current.id },
        data: { nextMatchId: next.id, nextSlot },
      });
    }
  }

  return { bracketId: bracket.id, matchIds };
}

const REDUCTION_TOKEN_PREFIX = "__REDUCTION__:";

function normalizeZonePlanSlotId(slot: string | null | undefined) {
  if (!slot) return null;
  return slot.startsWith(REDUCTION_TOKEN_PREFIX) ? null : slot;
}

export async function createZoneBracketMatchesFromPlan(
  tx: BracketDb,
  args: {
    tournamentId: string;
    zoneId: string;
    plan: ZoneBracketPlan;
    seedingMode?: "RANDOM" | "LEVEL_BASED" | "MANUAL";
    byeStrategy?: "EARLY" | "ROUND_BASED";
  }
): Promise<{ bracketId: string; matchIds: string[] }> {
  const bracket = await ensureBracket(tx, args.tournamentId, "ZONE", args.zoneId, {
    seedingMode: args.seedingMode,
    byeStrategy: args.byeStrategy,
  });

  const roundIdByKey = new Map<string, string>();
  for (const round of args.plan.rounds) {
    const createdRound = await tx.bracketRound.create({
      data: {
        bracketId: bracket.id,
        matchDayId: null,
        roundNumber: round.roundNumber,
        name: round.name,
        targetSize: round.matches.length,
        sortOrder: round.roundNumber,
      },
    });
    roundIdByKey.set(`${round.roundType}:${round.roundNumber}`, createdRound.id);
  }

  const createdMatches: Array<{
    id: string;
    roundType: "REDUCTION" | "NORMAL";
    roundNumber: number;
    matchNumber: number;
    rawEntryIdA: string | null;
    rawEntryIdB: string | null;
  }> = [];

  for (const round of args.plan.rounds) {
    const roundId = roundIdByKey.get(`${round.roundType}:${round.roundNumber}`);
    if (!roundId) continue;
    for (const match of round.matches) {
      const rawEntryIdA = match.entryIdA;
      const rawEntryIdB = match.entryIdB;
      const entryIdA = normalizeZonePlanSlotId(match.entryIdA);
      const entryIdB = normalizeZonePlanSlotId(match.entryIdB);
      const row = await tx.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          roundId,
          venueId: null,
          matchNumber: match.matchIndex,
          tableOrder: null,
          displayOrder: null,
          entryIdA,
          entryIdB,
          winnerEntryId: null,
          scoreA: null,
          scoreB: null,
          status: "PENDING",
          isBye: false,
          isReduction: match.isReduction,
          isManualOverride: false,
          nextMatchId: null,
          nextSlot: null,
          scheduledStartAt: null,
          hasIssue: false,
          issueNote: null,
          startedAt: null,
          completedAt: null,
          note: null,
        },
      });
      createdMatches.push({
        id: row.id,
        roundType: round.roundType,
        roundNumber: round.roundNumber,
        matchNumber: match.matchIndex,
        rawEntryIdA,
        rawEntryIdB,
      });
    }
  }

  for (const current of createdMatches) {
    if (current.roundType !== "NORMAL") continue;
    const nr = current.roundNumber + 1;
    const nm = Math.floor(current.matchNumber / 2);
    const nextSlot = current.matchNumber % 2 === 0 ? "A" : "B";
    const next = createdMatches.find(
      (match) => match.roundType === "NORMAL" && match.roundNumber === nr && match.matchNumber === nm
    );
    if (next) {
      await tx.bracketMatch.update({
        where: { id: current.id },
        data: { nextMatchId: next.id, nextSlot },
      });
    }
  }

  const reductionTargetByIndex = new Map<number, { matchId: string; slot: "A" | "B" }>();
  for (const match of createdMatches) {
    if (match.roundType !== "NORMAL" || match.roundNumber !== 1) continue;
    if (match.rawEntryIdA?.startsWith(REDUCTION_TOKEN_PREFIX)) {
      reductionTargetByIndex.set(Number(match.rawEntryIdA.slice(REDUCTION_TOKEN_PREFIX.length)), {
        matchId: match.id,
        slot: "A",
      });
    }
    if (match.rawEntryIdB?.startsWith(REDUCTION_TOKEN_PREFIX)) {
      reductionTargetByIndex.set(Number(match.rawEntryIdB.slice(REDUCTION_TOKEN_PREFIX.length)), {
        matchId: match.id,
        slot: "B",
      });
    }
  }

  for (const [reductionIndex, target] of reductionTargetByIndex.entries()) {
    const source = createdMatches.find(
      (match) => match.roundType === "REDUCTION" && match.matchNumber === reductionIndex
    );
    if (!source) continue;
    await tx.bracketMatch.update({
      where: { id: source.id },
      data: { nextMatchId: target.matchId, nextSlot: target.slot },
    });
  }

  return { bracketId: bracket.id, matchIds: createdMatches.map((m) => m.id) };
}

export async function patchBracketMatchByKind(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  matchId: string,
  body: {
    scoreA?: number;
    scoreB?: number;
    winnerEntryId?: string | null;
    status?: string;
    entryIdA?: string | null;
    entryIdB?: string | null;
    matchVenueId?: string | null;
    scheduledStartAt?: string | null;
    hasIssue?: boolean;
    issueNote?: string | null;
    isManualOverride?: boolean;
  },
  opts?: { actorUserId?: string; allowCompletedResultEdit?: boolean; zoneId?: string | null }
): Promise<{ ok: true; match: BracketMatch } | { ok: false; status: number; error: string }> {
  const match = await db.bracketMatch.findFirst({
    where: { id: matchId, bracket: buildBracketWhere(tournamentId, kind, opts?.zoneId) },
    include: { bracket: true, round: true },
  });
  if (!match) return { ok: false, status: 404, error: "경기를 찾을 수 없습니다." };
  const allowCompleted = opts?.allowCompletedResultEdit !== false;
  const touchesCore =
    body.entryIdA !== undefined ||
    body.entryIdB !== undefined ||
    body.winnerEntryId !== undefined ||
    body.scoreA !== undefined ||
    body.scoreB !== undefined ||
    body.status !== undefined;
  if (match.status === "COMPLETED" && !allowCompleted && touchesCore) {
    return { ok: false, status: 403, error: "완료된 경기 결과 수정이 비활성화되어 있습니다." };
  }
  if (body.entryIdA !== undefined || body.entryIdB !== undefined) {
    const confirmedIds = await db.tournamentEntry
      .findMany({ where: { tournamentId, status: "CONFIRMED" }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id)));
    const check = (id: string | null | undefined) => id == null || id === "" || confirmedIds.has(id);
    if (body.entryIdA !== undefined && !check(body.entryIdA)) return { ok: false, status: 400, error: "A 슬롯에는 참가확정자만 배치할 수 있습니다." };
    if (body.entryIdB !== undefined && !check(body.entryIdB)) return { ok: false, status: 400, error: "B 슬롯에는 참가확정자만 배치할 수 있습니다." };
  }
  if (body.winnerEntryId != null && body.winnerEntryId !== "") {
    const valid = (body.entryIdA ?? match.entryIdA) === body.winnerEntryId || (body.entryIdB ?? match.entryIdB) === body.winnerEntryId;
    if (!valid) return { ok: false, status: 400, error: "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다." };
  }
  let scheduledParsed: Date | null | undefined;
  if (body.scheduledStartAt !== undefined) {
    if (body.scheduledStartAt === null || body.scheduledStartAt === "") {
      scheduledParsed = null;
    } else {
      const d = new Date(body.scheduledStartAt);
      if (Number.isNaN(d.getTime())) return { ok: false, status: 400, error: "예정 시각이 올바르지 않습니다." };
      scheduledParsed = d;
    }
  }
  const data: Record<string, unknown> = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId != null && body.winnerEntryId !== "" && body.status === undefined) data.status = "COMPLETED";
  if (body.entryIdA !== undefined) data.entryIdA = body.entryIdA || null;
  if (body.entryIdB !== undefined) data.entryIdB = body.entryIdB || null;
  if (body.matchVenueId !== undefined) data.venueId = body.matchVenueId || null;
  if (scheduledParsed !== undefined) data.scheduledStartAt = scheduledParsed;
  if (body.hasIssue !== undefined) data.hasIssue = body.hasIssue;
  if (body.issueNote !== undefined) data.issueNote = body.issueNote?.trim() ? body.issueNote.trim() : null;
  if (body.isManualOverride !== undefined) data.isManualOverride = body.isManualOverride;
  const slotsChanged =
    (body.entryIdA !== undefined && body.entryIdA !== match.entryIdA) ||
    (body.entryIdB !== undefined && body.entryIdB !== match.entryIdB);
  if (slotsChanged) {
    data.winnerEntryId = null;
    data.scoreA = null;
    data.scoreB = null;
    data.status = "PENDING";
  }
  const updated = await db.bracketMatch.update({
    where: { id: matchId },
    data: data as Prisma.BracketMatchUpdateInput,
  });
  if (slotsChanged) {
    await clearBracketDownstreamByKind(db, tournamentId, kind, matchId, opts?.zoneId);
  }
  if (updated.status === "COMPLETED" && updated.winnerEntryId) {
    await onBracketMatchCompletedByKind(db, tournamentId, kind, updated, opts?.zoneId);
  }
  await refreshBracketMatchProgressStateByKind(db, tournamentId, kind, matchId, opts?.zoneId);
  return { ok: true, match: updated };
}

export async function syncBracketMatchProgressStatesByKind(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  zoneId?: string | null
): Promise<void> {
  for (let pass = 0; pass < 12; pass++) {
    const list = await db.bracketMatch.findMany({
      where: { bracket: buildBracketWhere(tournamentId, kind, zoneId) },
      orderBy: [{ round: { roundNumber: "asc" } }, { matchNumber: "asc" }],
    });
    let progressed = false;
    for (const m of list) {
      if (!m.isBye) continue;
      const sole = m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
      if (!sole) continue;
      await db.bracketMatch.update({
        where: { id: m.id },
        data: {
          winnerEntryId: sole,
          status: "COMPLETED",
          scoreA: m.entryIdA ? 1 : 0,
          scoreB: m.entryIdB ? 1 : 0,
          completedAt: new Date(),
        },
      });
      const u = await db.bracketMatch.findUnique({ where: { id: m.id } });
      if (u?.winnerEntryId && u.nextMatchId && u.nextSlot) {
        await onBracketMatchCompletedByKind(db, tournamentId, kind, u, zoneId);
      }
      progressed = true;
    }
    for (const m of list) {
      await refreshBracketMatchProgressStateByKind(db, tournamentId, kind, m.id, zoneId);
    }
    if (!progressed) break;
  }
}

async function clearBracketDownstreamByKind(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  matchId: string,
  zoneId?: string | null
): Promise<void> {
  const match = await db.bracketMatch.findFirst({ where: { id: matchId, bracket: buildBracketWhere(tournamentId, kind, zoneId) } });
  if (!match?.nextMatchId || !match.nextSlot) return;
  const data = match.nextSlot === "A"
    ? { entryIdA: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const }
    : { entryIdB: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const };
  await db.bracketMatch.update({ where: { id: match.nextMatchId }, data });
  await clearBracketDownstreamByKind(db, tournamentId, kind, match.nextMatchId, zoneId);
}

async function refreshBracketMatchProgressStateByKind(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  matchId: string,
  zoneId?: string | null
): Promise<void> {
  const m = await db.bracketMatch.findFirst({ where: { id: matchId, bracket: buildBracketWhere(tournamentId, kind, zoneId) } });
  if (!m) return;
  if (m.status === "COMPLETED") return;
  const hasA = m.entryIdA != null && m.entryIdA !== "";
  const hasB = m.entryIdB != null && m.entryIdB !== "";
  if (!hasA || !hasB) {
    if (m.status === "READY" || m.status === "IN_PROGRESS") {
      await db.bracketMatch.update({ where: { id: matchId }, data: { status: "PENDING" } });
    }
    return;
  }
  if (m.status === "PENDING") {
    await db.bracketMatch.update({ where: { id: matchId }, data: { status: "READY" } });
  }
}

async function onBracketMatchCompletedByKind(
  db: BracketDb,
  tournamentId: string,
  kind: "MAIN" | "ZONE" | "FINAL",
  completed: BracketMatch,
  zoneId?: string | null
): Promise<void> {
  if (!completed.winnerEntryId || !completed.nextMatchId || !completed.nextSlot) return;
  const slot = completed.nextSlot as "A" | "B";
  const nextUpdate = slot === "A" ? { entryIdA: completed.winnerEntryId } : { entryIdB: completed.winnerEntryId };
  await db.bracketMatch.update({ where: { id: completed.nextMatchId }, data: nextUpdate });
  await refreshBracketMatchProgressStateByKind(db, tournamentId, kind, completed.nextMatchId, zoneId);
}

export async function patchMainBracketMatch(
  db: BracketDb,
  tournamentId: string,
  matchId: string,
  body: {
    scoreA?: number;
    scoreB?: number;
    winnerEntryId?: string | null;
    status?: string;
    entryIdA?: string | null;
    entryIdB?: string | null;
    matchVenueId?: string | null;
    scheduledStartAt?: string | null;
    hasIssue?: boolean;
    issueNote?: string | null;
  },
  opts?: { actorUserId?: string; allowCompletedResultEdit?: boolean }
): Promise<{ ok: true; match: BracketMatch } | { ok: false; status: number; error: string }> {
  const match = await db.bracketMatch.findFirst({
    where: { id: matchId, bracket: { tournamentId, kind: "MAIN" } },
    include: { bracket: true, round: true },
  });
  if (!match) return { ok: false, status: 404, error: "경기를 찾을 수 없습니다." };

  const allowCompleted = opts?.allowCompletedResultEdit !== false;
  const touchesCore =
    body.entryIdA !== undefined ||
    body.entryIdB !== undefined ||
    body.winnerEntryId !== undefined ||
    body.scoreA !== undefined ||
    body.scoreB !== undefined ||
    body.status !== undefined;
  if (match.status === "COMPLETED" && !allowCompleted && touchesCore) {
    return { ok: false, status: 403, error: "완료된 경기 결과 수정이 비활성화되어 있습니다." };
  }

  if (body.entryIdA !== undefined || body.entryIdB !== undefined) {
    const confirmedIds = await db.tournamentEntry
      .findMany({ where: { tournamentId, status: "CONFIRMED" }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id)));
    const check = (id: string | null | undefined) => id == null || id === "" || confirmedIds.has(id);
    if (body.entryIdA !== undefined && !check(body.entryIdA)) {
      return { ok: false, status: 400, error: "A 슬롯에는 참가확정자만 배치할 수 있습니다." };
    }
    if (body.entryIdB !== undefined && !check(body.entryIdB)) {
      return { ok: false, status: 400, error: "B 슬롯에는 참가확정자만 배치할 수 있습니다." };
    }
  }

  if (body.winnerEntryId != null && body.winnerEntryId !== "") {
    const valid = (body.entryIdA ?? match.entryIdA) === body.winnerEntryId || (body.entryIdB ?? match.entryIdB) === body.winnerEntryId;
    if (!valid) {
      return { ok: false, status: 400, error: "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다." };
    }
  }
  if (body.scoreA !== undefined && (typeof body.scoreA !== "number" || body.scoreA < 0)) {
    return { ok: false, status: 400, error: "점수는 0 이상이어야 합니다." };
  }
  if (body.scoreB !== undefined && (typeof body.scoreB !== "number" || body.scoreB < 0)) {
    return { ok: false, status: 400, error: "점수는 0 이상이어야 합니다." };
  }

  let scheduledParsed: Date | null | undefined;
  if (body.scheduledStartAt !== undefined) {
    if (body.scheduledStartAt === null || body.scheduledStartAt === "") {
      scheduledParsed = null;
    } else {
      const d = new Date(body.scheduledStartAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, status: 400, error: "예정 시각이 올바르지 않습니다." };
      }
      scheduledParsed = d;
    }
  }

  const data: Record<string, unknown> = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId != null && body.winnerEntryId !== "" && body.status === undefined) data.status = "COMPLETED";
  if (body.entryIdA !== undefined) data.entryIdA = body.entryIdA || null;
  if (body.entryIdB !== undefined) data.entryIdB = body.entryIdB || null;
  if (body.matchVenueId !== undefined) data.venueId = body.matchVenueId || null;
  if (scheduledParsed !== undefined) data.scheduledStartAt = scheduledParsed;
  if (body.hasIssue !== undefined) data.hasIssue = body.hasIssue;
  if (body.issueNote !== undefined) data.issueNote = body.issueNote?.trim() ? body.issueNote.trim() : null;

  const slotsChanged =
    (body.entryIdA !== undefined && body.entryIdA !== match.entryIdA) ||
    (body.entryIdB !== undefined && body.entryIdB !== match.entryIdB);
  if (slotsChanged) {
    data.winnerEntryId = null;
    data.scoreA = null;
    data.scoreB = null;
    data.status = "PENDING";
  }

  const updated = await db.bracketMatch.update({
    where: { id: matchId },
    data: data as Prisma.BracketMatchUpdateInput,
  });

  if (slotsChanged) {
    await clearBracketDownstream(db, tournamentId, matchId);
  }
  if (updated.status === "COMPLETED" && updated.winnerEntryId) {
    await onBracketMatchCompleted(db, tournamentId, updated);
  }
  await refreshBracketMatchProgressState(db, tournamentId, matchId);

  if (opts?.actorUserId) {
    try {
      const auditDb = db as unknown as {
        bracketAuditLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
      };
      await auditDb.bracketAuditLog.create({
        data: {
          tournamentId,
          bracketId: match.bracketId,
          matchId,
          actorUserId: opts.actorUserId,
          actorRole: "CLIENT_ADMIN",
          actionType: body.status === "IN_PROGRESS" ? "START" : updated.status === "COMPLETED" ? "RESULT" : "PATCH",
          beforeJson: null,
          afterJson: JSON.stringify({ body, resultStatus: updated.status, winnerEntryId: updated.winnerEntryId }),
          reason: null,
        },
      });
    } catch {
      // audit log failure should not block
    }
  }

  return { ok: true, match: updated };
}

async function clearBracketDownstream(db: BracketDb, tournamentId: string, matchId: string): Promise<void> {
  const match = await db.bracketMatch.findFirst({
    where: { id: matchId, bracket: { tournamentId, kind: "MAIN" } },
  });
  if (!match?.nextMatchId || !match.nextSlot) return;
  const data = match.nextSlot === "A"
    ? { entryIdA: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const }
    : { entryIdB: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const };
  await db.bracketMatch.update({ where: { id: match.nextMatchId }, data });
  await clearBracketDownstream(db, tournamentId, match.nextMatchId);
}

async function refreshBracketMatchProgressState(
  db: BracketDb,
  tournamentId: string,
  matchId: string
): Promise<void> {
  const m = await db.bracketMatch.findFirst({
    where: { id: matchId, bracket: { tournamentId, kind: "MAIN" } },
  });
  if (!m) return;
  if (m.status === "COMPLETED") return;
  const hasA = m.entryIdA != null && m.entryIdA !== "";
  const hasB = m.entryIdB != null && m.entryIdB !== "";
  if (!hasA || !hasB) {
    if (m.status === "READY" || m.status === "IN_PROGRESS") {
      await db.bracketMatch.update({ where: { id: matchId }, data: { status: "PENDING" } });
    }
    return;
  }
  if (m.status === "PENDING") {
    await db.bracketMatch.update({ where: { id: matchId }, data: { status: "READY" } });
  }
}

async function onBracketMatchCompleted(
  db: BracketDb,
  tournamentId: string,
  completed: BracketMatch
): Promise<void> {
  if (!completed.winnerEntryId || !completed.nextMatchId || !completed.nextSlot) return;
  const slot = completed.nextSlot as "A" | "B";
  const nextUpdate = slot === "A" ? { entryIdA: completed.winnerEntryId } : { entryIdB: completed.winnerEntryId };
  await db.bracketMatch.update({ where: { id: completed.nextMatchId }, data: nextUpdate });
  await refreshBracketMatchProgressState(db, tournamentId, completed.nextMatchId);
}

export async function syncMainBracketMatchProgressStates(db: BracketDb, tournamentId: string): Promise<void> {
  for (let pass = 0; pass < 12; pass++) {
    const list = await db.bracketMatch.findMany({
      where: { bracket: { tournamentId, kind: "MAIN" } },
      orderBy: [
        { round: { roundNumber: "asc" } },
        { matchNumber: "asc" },
      ],
    });
    let progressed = false;
    for (const m of list) {
      if (!m.isBye) continue;
      const sole = m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
      if (!sole) continue;
      await db.bracketMatch.update({
        where: { id: m.id },
        data: {
          winnerEntryId: sole,
          status: "COMPLETED",
          scoreA: m.entryIdA ? 1 : 0,
          scoreB: m.entryIdB ? 1 : 0,
          completedAt: new Date(),
        },
      });
      const u = await db.bracketMatch.findUnique({ where: { id: m.id } });
      if (u?.winnerEntryId && u.nextMatchId && u.nextSlot) {
        await onBracketMatchCompleted(db, tournamentId, u);
      }
      progressed = true;
    }
    for (const m of list) {
      await refreshBracketMatchProgressState(db, tournamentId, m.id);
    }
    if (!progressed) break;
  }
}

export async function autoSortMainBracketMatches(
  db: BracketDb,
  tournamentId: string,
  args: { baseStartAt: Date; intervalMinutes: number; roundGapMinutes: number }
): Promise<number> {
  const matches = await db.bracketMatch.findMany({
    where: { bracket: { tournamentId, kind: "MAIN" } },
    include: { round: { select: { roundNumber: true } } },
    orderBy: [{ round: { roundNumber: "asc" } }, { matchNumber: "asc" }],
  });
  if (matches.length === 0) return 0;
  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    const roundNumber = m.round.roundNumber;
    if (!byRound.has(roundNumber)) byRound.set(roundNumber, []);
    byRound.get(roundNumber)!.push(m);
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
  let cursor = args.baseStartAt.getTime();
  let updated = 0;
  for (const roundNumber of rounds) {
    const list = byRound.get(roundNumber)!;
    for (const m of list) {
      await db.bracketMatch.update({
        where: { id: m.id },
        data: { scheduledStartAt: new Date(cursor) } as Prisma.BracketMatchUpdateInput,
      });
      cursor += args.intervalMinutes * 60 * 1000;
      updated++;
    }
    cursor += args.roundGapMinutes * 60 * 1000;
  }
  return updated;
}

export function buildMainBracketPlanFromEntries(entryIds: string[]): FinalMatchCreate[] {
  const size = (() => {
    let s = 4;
    while (s < entryIds.length && s < 64) s *= 2;
    return s;
  })();
  const shuffled = [...entryIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const slots: (string | null)[] = [...shuffled];
  while (slots.length < size) slots.push(null);
  return sortBracketPlan(buildFinalBracketPlan(slots, size as 4 | 8 | 16 | 32 | 64));
}

