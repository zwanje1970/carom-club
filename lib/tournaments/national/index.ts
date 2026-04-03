import { prisma } from "@/lib/db";
import type { BracketSeedEntry } from "@/lib/bracket-engine";

export type NationalZoneCapacity = {
  zoneId: string;
  name: string;
  tableCount: number;
  venueCount?: number;
};

export type NationalEntryInput = {
  entryId: string;
  levelCode?: string | null;
  duplicateGroupKey?: string | null;
  matchDayId?: string | null;
  zoneId?: string | null;
};

export type NationalZoneAssignment = {
  entryId: string;
  zoneId: string;
  reason: "CAPACITY" | "LEVEL_BALANCE" | "DUPLICATE_SPLIT";
};

export function groupDuplicateEntries(entries: NationalEntryInput[]): Map<string, NationalEntryInput[]> {
  const map = new Map<string, NationalEntryInput[]>();
  for (const entry of entries) {
    const key = (entry.duplicateGroupKey ?? "").trim();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function estimateZoneCapacity(zone: NationalZoneCapacity): number {
  return Math.max(1, zone.tableCount * Math.max(1, zone.venueCount ?? 1));
}

export function assignEntriesToZonesBalanced(args: {
  entries: NationalEntryInput[];
  zones: NationalZoneCapacity[];
}): NationalZoneAssignment[] {
  const zones = [...args.zones];
  if (zones.length === 0) return [];

  const byCapacity = zones
    .map((zone) => ({
      zone,
      score: estimateZoneCapacity(zone),
      load: 0,
    }))
    .sort((a, b) => b.score - a.score || a.zone.zoneId.localeCompare(b.zone.zoneId));

  const assignments: NationalZoneAssignment[] = [];
  const duplicates = groupDuplicateEntries(args.entries);

  const ordered: NationalEntryInput[] = [];
  for (const group of duplicates.values()) {
    ordered.push(...group);
  }
  const seen = new Set(ordered.map((entry) => entry.entryId));
  for (const entry of args.entries) {
    if (!seen.has(entry.entryId)) ordered.push(entry);
  }

  const byLevel = [...ordered].sort((a, b) => {
    const la = (a.levelCode ?? "").localeCompare(b.levelCode ?? "");
    if (la !== 0) return la;
    return a.entryId.localeCompare(b.entryId);
  });

  for (const entry of byLevel) {
    const candidate = byCapacity
      .slice()
      .sort((a, b) => a.load - b.load || b.score - a.score || a.zone.zoneId.localeCompare(b.zone.zoneId))[0];
    candidate.load += 1;
    assignments.push({
      entryId: entry.entryId,
      zoneId: candidate.zone.zoneId,
      reason:
        (entry.duplicateGroupKey ?? "").trim().length > 0
          ? "DUPLICATE_SPLIT"
          : entry.levelCode
            ? "LEVEL_BALANCE"
            : "CAPACITY",
    });
  }

  return assignments;
}

export function computeZoneFinalTargets(args: {
  targetFinalSize: number;
  zones: { zoneId: string; participantCount: number; tableCount: number }[];
}): Record<string, number> {
  const active = args.zones.filter((z) => z.participantCount > 0);
  if (active.length === 0) return {};
  const total = active.reduce((sum, z) => sum + z.participantCount, 0);
  if (total <= 0) return {};

  const raw = active.map((z) => ({
    zoneId: z.zoneId,
    weight: Math.max(1, z.participantCount) * Math.max(1, z.tableCount),
  }));
  const weightSum = raw.reduce((sum, z) => sum + z.weight, 0);

  const targets: Record<string, number> = {};
  let assigned = 0;
  for (const row of raw) {
    const share = Math.max(1, Math.round((args.targetFinalSize * row.weight) / weightSum));
    targets[row.zoneId] = share;
    assigned += share;
  }

  let diff = args.targetFinalSize - assigned;
  const order = [...raw].sort((a, b) => b.weight - a.weight || a.zoneId.localeCompare(b.zoneId));
  let idx = 0;
  while (diff !== 0 && order.length > 0) {
    const zoneId = order[idx % order.length]!.zoneId;
    if (diff > 0) {
      targets[zoneId] += 1;
      diff -= 1;
    } else if (targets[zoneId] > 1) {
      targets[zoneId] -= 1;
      diff += 1;
    }
    idx++;
  }
  return targets;
}

export function buildReductionCandidates(args: {
  entries: BracketSeedEntry[];
  targetFinalSize: number;
}): BracketSeedEntry[] {
  if (args.entries.length <= args.targetFinalSize) return [];
  const sameLevel = [...args.entries].sort((a, b) => {
    const la = (a.levelCode ?? "").localeCompare(b.levelCode ?? "");
    if (la !== 0) return la;
    return a.entryId.localeCompare(b.entryId);
  });
  return sameLevel.slice(args.targetFinalSize);
}

export function calculateEstimatedFinishMinutes(args: {
  participantCount: number;
  tableCount: number;
  baseMatchMinutes: number;
  roundGapMinutes: number;
}): number {
  const matchCount = Math.max(0, args.participantCount - 1);
  const capacity = Math.max(1, args.tableCount);
  const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, args.participantCount))));
  const batches = Math.max(1, Math.ceil(matchCount / capacity));
  return batches * Math.max(1, args.baseMatchMinutes) + Math.max(0, rounds - 1) * Math.max(0, args.roundGapMinutes);
}

export type NationalZoneOverview = {
  tournamentZoneId: string;
  zoneId: string;
  zoneName: string;
  zoneCode: string | null;
  participantCount: number;
  tableCount: number;
  matchDayId: string | null;
  venueId: string | null;
  qualifierTarget: number | null;
};

function getEffectiveTableCount(zone: {
  venue?: { tableCount: number } | null;
}) {
  return Math.max(1, zone.venue?.tableCount ?? 1);
}

export async function loadNationalZoneOverview(tournamentId: string): Promise<NationalZoneOverview[]> {
  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } }, venue: { select: { tableCount: true } } },
  });
  const counts = await prisma.tournamentEntry.groupBy({
    by: ["zoneId"],
    where: { tournamentId, zoneId: { not: null }, status: "CONFIRMED" },
    _count: { id: true },
  });
  const countMap = Object.fromEntries(counts.map((row) => [row.zoneId ?? "", row._count.id]));
  return zones.map((tz) => ({
    tournamentZoneId: tz.id,
    zoneId: tz.zoneId,
    zoneName: tz.name ?? tz.zone.name,
    zoneCode: tz.code ?? tz.zone.code,
    participantCount: countMap[tz.id] ?? 0,
    tableCount: getEffectiveTableCount(tz),
    matchDayId: tz.matchDayId,
    venueId: tz.venueId,
    qualifierTarget: tz.qualifierTarget ?? null,
  }));
}

export async function autoAssignTournamentEntriesToZones(
  tournamentId: string,
  actorUserId?: string
): Promise<{ assigned: number; assignments: NationalZoneAssignment[] }> {
  const [entries, zones] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: {
        tournamentId,
        status: "CONFIRMED",
        zoneId: null,
      },
      orderBy: [{ duplicateGroupKey: "asc" }, { levelCode: "asc" }, { id: "asc" }],
    }),
    prisma.tournamentZone.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
      include: {
        venue: { select: { tableCount: true } },
        zone: { select: { name: true } },
      },
    }),
  ]);
  if (zones.length === 0 || entries.length === 0) {
    return { assigned: 0, assignments: [] };
  }

  const assignments = assignEntriesToZonesBalanced({
    entries: entries.map((e) => ({
      entryId: e.id,
      levelCode: e.levelCode,
      duplicateGroupKey: e.duplicateGroupKey,
      matchDayId: e.matchDayId,
      zoneId: e.zoneId,
    })),
    zones: zones.map((z) => ({
      zoneId: z.id,
      name: z.name ?? z.zone.name,
      tableCount: getEffectiveTableCount(z),
      venueCount: z.venue?.tableCount ?? 1,
    })),
  });

  const byEntryId = new Map(assignments.map((a) => [a.entryId, a.zoneId]));
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const zoneId = byEntryId.get(entry.id);
      if (!zoneId) continue;
      const zone = zones.find((z) => z.id === zoneId);
      await tx.tournamentEntry.update({
        where: { id: entry.id },
        data: {
          zoneId,
          matchDayId: entry.matchDayId ?? zone?.matchDayId ?? null,
          isWaitlist: false,
          entryStatus: "CONFIRMED",
          status: "CONFIRMED",
        },
      });
      await tx.tournamentEntryZoneAssignment.upsert({
        where: { tournamentEntryId: entry.id },
        create: {
          tournamentEntryId: entry.id,
          tournamentZoneId: zoneId,
          assignmentType: "AUTO",
          assignedByUserId: actorUserId ?? null,
        },
        update: {
          tournamentZoneId: zoneId,
          assignmentType: "AUTO",
          assignedByUserId: actorUserId ?? null,
        },
      });
    }
  });

  return { assigned: assignments.length, assignments };
}

export async function assignTournamentEntryToZone(args: {
  tournamentId: string;
  entryId: string;
  tournamentZoneId: string;
  actorUserId?: string;
  assignmentType?: "AUTO" | "MANUAL";
  notes?: string | null;
}) {
  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: args.entryId, tournamentId: args.tournamentId },
  });
  if (!entry) return null;
  const zone = await prisma.tournamentZone.findFirst({
    where: { id: args.tournamentZoneId, tournamentId: args.tournamentId },
    include: { matchDay: true },
  });
  if (!zone) return null;

  const updated = await prisma.$transaction(async (tx) => {
    const entryUpdated = await tx.tournamentEntry.update({
      where: { id: args.entryId },
      data: {
        zoneId: args.tournamentZoneId,
        matchDayId: entry.matchDayId ?? zone.matchDayId ?? null,
        isWaitlist: false,
        entryStatus: "CONFIRMED",
        status: "CONFIRMED",
      },
    });
    const existing = await tx.tournamentEntryZoneAssignment.findUnique({
      where: { tournamentEntryId: args.entryId },
    });
    const payload = {
      tournamentZoneId: args.tournamentZoneId,
      assignmentType: args.assignmentType ?? "MANUAL",
      assignedAt: new Date(),
      assignedByUserId: args.actorUserId ?? null,
      notes: args.notes ?? null,
    };
    if (existing) {
      await tx.tournamentEntryZoneAssignment.update({
        where: { id: existing.id },
        data: payload,
      });
    } else {
      await tx.tournamentEntryZoneAssignment.create({
        data: {
          tournamentEntryId: args.entryId,
          ...payload,
        },
      });
    }
    return entryUpdated;
  });

  return updated;
}

export async function clearTournamentEntryZoneAssignment(args: {
  tournamentId: string;
  entryId: string;
}) {
  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: args.entryId, tournamentId: args.tournamentId },
  });
  if (!entry) return null;
  await prisma.$transaction(async (tx) => {
    await tx.tournamentEntry.update({
      where: { id: args.entryId },
      data: {
        zoneId: null,
      },
    });
    const existing = await tx.tournamentEntryZoneAssignment.findUnique({
      where: { tournamentEntryId: args.entryId },
    });
    if (existing) {
      await tx.tournamentEntryZoneAssignment.delete({ where: { id: existing.id } });
    }
  });
  return true;
}

export async function buildNationalFinalTargets(tournamentId: string): Promise<Record<string, number>> {
  const zones = await loadNationalZoneOverview(tournamentId);
  const targetFinalSize =
    (await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { targetFinalSize: true },
    }))?.targetFinalSize ??
    zones.reduce((sum, z) => sum + (z.qualifierTarget ?? 0), 0);
  return computeZoneFinalTargets({
    targetFinalSize: Math.max(1, targetFinalSize || 1),
    zones: zones.map((z) => ({
      zoneId: z.tournamentZoneId,
      participantCount: z.participantCount,
      tableCount: z.tableCount,
    })),
  });
}

export async function syncNationalWaitlistEntries(tournamentId: string): Promise<number> {
  const entries = await prisma.tournamentEntry.findMany({
    where: {
      tournamentId,
      waitingListOrder: { not: null },
      status: "APPLIED",
    },
    orderBy: [{ waitingListOrder: "asc" }, { createdAt: "asc" }],
  });
  await prisma.tournamentWaitlistEntry.deleteMany({ where: { tournamentId } });
  if (entries.length === 0) return 0;
  let count = 0;
  for (const entry of entries) {
    const priorityOrder = entry.waitingListOrder ?? 0;
    await prisma.tournamentWaitlistEntry.create({
      data: {
        tournamentId,
        matchDayId: entry.matchDayId,
        zoneId: entry.zoneId,
        userId: entry.userId,
        displayName: entry.displayName ?? entry.depositorName ?? "",
        levelCode: entry.levelCode,
        priorityOrder,
        status: "WAITING",
      },
    });
    await prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { isWaitlist: true },
    });
    count += 1;
  }
  return count;
}

export async function autoExcludeDuplicateSecondDayEntries(
  tournamentId: string,
  qualifiedEntryIds: string[]
): Promise<number> {
  if (qualifiedEntryIds.length === 0) return 0;
  const qualifiedEntries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, id: { in: qualifiedEntryIds } },
    select: { duplicateGroupKey: true, matchDayId: true },
  });
  const groupKeys = Array.from(
    new Set(
      qualifiedEntries
        .map((e) => (e.duplicateGroupKey ?? "").trim())
        .filter((key) => key.length > 0)
    )
  );
  if (groupKeys.length === 0) return 0;

  const days = await prisma.tournamentMatchDay.findMany({
    where: { tournamentId },
    select: { id: true, sortOrder: true },
  });
  const dayOrder = new Map(days.map((d) => [d.id, d.sortOrder]));

  const affected = await prisma.tournamentEntry.findMany({
    where: {
      tournamentId,
      duplicateGroupKey: { in: groupKeys },
      id: { notIn: qualifiedEntryIds },
    },
    select: { id: true, duplicateGroupKey: true, matchDayId: true, entryStatus: true, status: true },
  });

  let updated = 0;
  for (const entry of affected) {
    const qualified = qualifiedEntries.find((q) => (q.duplicateGroupKey ?? "").trim() === (entry.duplicateGroupKey ?? "").trim());
    if (!qualified) continue;
    const qOrder = qualified.matchDayId ? dayOrder.get(qualified.matchDayId) ?? 0 : 0;
    const eOrder = entry.matchDayId ? dayOrder.get(entry.matchDayId) ?? 0 : 0;
    if (eOrder <= qOrder) continue;
    await prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: {
        entryStatus: "AUTO_EXCLUDED",
        status: "AUTO_EXCLUDED",
        isWaitlist: false,
      },
    });
    updated += 1;
  }
  return updated;
}

export async function listZoneManagers(tournamentZoneId: string) {
  return prisma.tournamentZoneManager.findMany({
    where: { zoneId: tournamentZoneId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      approvedByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listZoneManagerApplications(tournamentId: string) {
  return prisma.zoneManagerApplication.findMany({
    where: { tournamentId },
    include: {
      zone: { include: { zone: { select: { name: true, code: true } } } },
      user: { select: { id: true, name: true, email: true } },
      reviewedByUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function submitZoneManagerApplication(args: {
  tournamentId: string;
  userId: string;
  zoneId?: string | null;
  message?: string | null;
}) {
  const existing = await prisma.zoneManagerApplication.findFirst({
    where: {
      tournamentId: args.tournamentId,
      userId: args.userId,
      zoneId: args.zoneId ?? null,
      status: "PENDING",
    },
  });
  if (existing) return existing;
  return prisma.zoneManagerApplication.create({
    data: {
      tournamentId: args.tournamentId,
      zoneId: args.zoneId ?? null,
      userId: args.userId,
      status: "PENDING",
      message: args.message ?? null,
    },
  });
}

export async function approveZoneManagerApplication(applicationId: string, reviewerUserId: string) {
  const application = await prisma.zoneManagerApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) return null;

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.zoneManagerApplication.update({
      where: { id: applicationId },
      data: {
        status: "APPROVED",
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
    if (app.zoneId) {
      await tx.tournamentZoneManager.upsert({
        where: { zoneId_userId: { zoneId: app.zoneId, userId: app.userId } },
        create: {
          zoneId: app.zoneId,
          userId: app.userId,
          approvedByUserId: reviewerUserId,
        },
        update: {
          approvedByUserId: reviewerUserId,
        },
      });
    }
    return app;
  });
  return updated;
}
