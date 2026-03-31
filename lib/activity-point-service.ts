import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";

export const ACTIVITY_POINT_RULES = {
  COMMUNITY_POST_CREATE: 1,
  COMMUNITY_COMMENT_CREATE: 1,
  SOLVER_SOLUTION_CREATE: 5,
  SOLVER_SOLUTION_GOOD: 2,
  SOLVER_SOLUTION_ACCEPT: 10,
  NOTE_SEND_TO_SOLVER: 3,
} as const;

export const ACTIVITY_POINT_TYPES = {
  COMMUNITY_POST_CREATE: "community_post_create",
  COMMUNITY_COMMENT_CREATE: "community_comment_create",
  SOLVER_SOLUTION_CREATE: "solver_solution_create",
  SOLVER_SOLUTION_GOOD: "solver_solution_good",
  SOLVER_SOLUTION_ACCEPT: "solver_solution_accept",
  NOTE_SEND_TO_SOLVER: "note_send_to_solver",
} as const;

type ActivityPointType = (typeof ACTIVITY_POINT_TYPES)[keyof typeof ACTIVITY_POINT_TYPES];
type PointRuleKey = keyof typeof ACTIVITY_POINT_RULES;
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const AUTO_ROLE_THRESHOLDS = [
  { minPoints: 30, roleKey: "SOLVER", label: "해결사" },
  { minPoints: 10, roleKey: "NOTE_USER", label: "당구노트 사용자" },
  { minPoints: 0, roleKey: "USER", label: "일반회원" },
] as const;

const AUTO_SYNC_ROLE_KEYS = new Set(["USER", "NOTE_USER", "SOLVER"]);
const AUTO_SYNC_LEGACY_ROLES = new Set(["USER"]);

export type SuggestedRole = {
  roleKey: "USER" | "NOTE_USER" | "SOLVER";
  label: string;
  minPoints: number;
};

type GrantUserPointsOptions = {
  refType?: string;
  refId?: string;
  description?: string;
  idempotencyKey?: string;
};

function getRulePoints(ruleKey: PointRuleKey, points?: number): number {
  return typeof points === "number" ? points : ACTIVITY_POINT_RULES[ruleKey];
}

function getRuleType(ruleKey: PointRuleKey, type?: ActivityPointType): ActivityPointType {
  return type ?? ACTIVITY_POINT_TYPES[ruleKey];
}

export function getSuggestedRoleByPoints(pointTotal: number): SuggestedRole {
  const matched =
    AUTO_ROLE_THRESHOLDS.find((item) => pointTotal >= item.minPoints) ?? AUTO_ROLE_THRESHOLDS.at(-1)!;

  return {
    roleKey: matched.roleKey,
    label: matched.label,
    minPoints: matched.minPoints,
  };
}

export async function getUserActivityPointTotal(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activityPoint: true },
  });
  return user?.activityPoint ?? 0;
}

async function createPointLedgerEntry(
  tx: TxClient,
  userId: string,
  type: ActivityPointType,
  points: number,
  options: GrantUserPointsOptions
) {
  if (points === 0) {
    return { created: false as const };
  }

  if (options.idempotencyKey) {
    const existing = await tx.userActivityPoint.findFirst({
      where: { idempotencyKey: options.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return { created: false as const };
    }
  }

  try {
    await tx.userActivityPoint.create({
      data: {
        userId,
        type,
        points,
        refType: options.refType ?? null,
        refId: options.refId ?? null,
        description: options.description ?? null,
        idempotencyKey: options.idempotencyKey ?? null,
      },
    });
  } catch (error) {
    if (
      options.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { created: false as const };
    }
    throw error;
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      activityPoint: { increment: points },
    },
  });

  return { created: true as const };
}

export async function syncUserRoleFromPoints(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      roleId: true,
      roleManualLocked: true,
      activityPoint: true,
      rbacRole: {
        select: { id: true, key: true, label: true },
      },
    },
  });

  if (!user) {
    return { synced: false as const, reason: "user_not_found" as const };
  }

  const suggestedRole = getSuggestedRoleByPoints(user.activityPoint ?? 0);
  if (user.roleManualLocked) {
    return { synced: false as const, reason: "manual_locked" as const, suggestedRole };
  }

  const currentRoleKey = user.rbacRole?.key ?? null;
  const canAutoSyncCurrentRole =
    (currentRoleKey != null && AUTO_SYNC_ROLE_KEYS.has(currentRoleKey)) ||
    (currentRoleKey == null && AUTO_SYNC_LEGACY_ROLES.has(user.role));

  if (!canAutoSyncCurrentRole) {
    return { synced: false as const, reason: "manual_or_special_role" as const, suggestedRole };
  }

  if (currentRoleKey === suggestedRole.roleKey) {
    return { synced: false as const, reason: "already_synced" as const, suggestedRole };
  }

  const role = await prisma.role.findUnique({
    where: { key: suggestedRole.roleKey },
    select: { id: true, key: true, label: true },
  });

  if (!role) {
    return { synced: false as const, reason: "suggested_role_missing" as const, suggestedRole };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { roleId: role.id },
  });

  return {
    synced: true as const,
    suggestedRole,
    role: {
      id: role.id,
      key: role.key,
      label: role.label,
    },
  };
}

export async function grantUserPoints(
  userId: string,
  ruleKey: PointRuleKey,
  points?: number,
  options: GrantUserPointsOptions & { type?: ActivityPointType } = {}
) {
  const amount = getRulePoints(ruleKey, points);
  const type = getRuleType(ruleKey, options.type);

  const result = await prisma.$transaction(async (tx) => {
    return createPointLedgerEntry(tx, userId, type, amount, options);
  });

  if (result.created) {
    await syncUserRoleFromPoints(userId);
  }

  return result;
}

export async function getRecentUserActivityPoints(userId: string, take = 10) {
  const rows = await prisma.userActivityPoint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      points: true,
      refType: true,
      refId: true,
      description: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getSolverRanking(options?: { take?: number }) {
  const take = Math.max(1, Math.min(100, options?.take ?? 20));

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { nanguSolutions: { some: {} } },
        { troubleShotSolutions: { some: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      roleId: true,
      activityPoint: true,
      rbacRole: {
        select: { key: true, label: true },
      },
      nanguSolutions: {
        select: { id: true, goodCount: true, adoptedByPost: { select: { id: true } } },
      },
      troubleShotSolutions: {
        select: { id: true, goodCount: true, isAccepted: true },
      },
    },
  });

  const ranked = users
    .map((user) => {
      const nanguSolutionCount = user.nanguSolutions.length;
      const troubleSolutionCount = user.troubleShotSolutions.length;
      const solutionCount = nanguSolutionCount + troubleSolutionCount;
      const goodCount =
        user.nanguSolutions.reduce((sum, item) => sum + (item.goodCount ?? 0), 0) +
        user.troubleShotSolutions.reduce((sum, item) => sum + (item.goodCount ?? 0), 0);
      const acceptedCount =
        user.nanguSolutions.filter((item) => !!item.adoptedByPost).length +
        user.troubleShotSolutions.filter((item) => item.isAccepted).length;
      const suggestedRole = getSuggestedRoleByPoints(user.activityPoint ?? 0);

      return {
        userId: user.id,
        name: user.name,
        username: user.username,
        currentRoleKey: user.rbacRole?.key ?? null,
        currentRoleLabel: user.rbacRole?.label ?? null,
        suggestedRoleKey: suggestedRole.roleKey,
        suggestedRoleLabel: suggestedRole.label,
        solutionCount,
        acceptedCount,
        goodCount,
        activityPoint: user.activityPoint ?? 0,
      };
    })
    .sort((a, b) => {
      if (b.acceptedCount !== a.acceptedCount) return b.acceptedCount - a.acceptedCount;
      if (b.goodCount !== a.goodCount) return b.goodCount - a.goodCount;
      if (b.solutionCount !== a.solutionCount) return b.solutionCount - a.solutionCount;
      return b.activityPoint - a.activityPoint;
    })
    .slice(0, take)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return ranked;
}
