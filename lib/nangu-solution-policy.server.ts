import "server-only";

import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { getLevelFromScore } from "@/lib/community-level";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import type { PermissionSubject } from "@/lib/auth/permissions";

export type NanguSolutionAccessState = {
  allowed: boolean;
  minSolutionLevelForUser: number;
  userLevel: number | null;
  appliesUserLevelPolicy: boolean;
  reason: "ok" | "login_required" | "permission_denied" | "level_too_low";
};

export async function getMinSolutionLevelForUser(): Promise<number> {
  const settings = await getSiteSettings();
  return Math.min(15, Math.max(1, Math.floor(Number(settings.minSolutionLevelForUser ?? 1)) || 1));
}

export async function getNanguSolutionAccessState(
  user: PermissionSubject | null
): Promise<NanguSolutionAccessState> {
  const minSolutionLevelForUser = await getMinSolutionLevelForUser();
  if (!user?.id) {
    return {
      allowed: false,
      minSolutionLevelForUser,
      userLevel: null,
      appliesUserLevelPolicy: false,
      reason: "login_required",
    };
  }

  const canCreateByPermission = await hasPermission(user, PERMISSION_KEYS.SOLVER_SOLUTION_CREATE);
  if (!canCreateByPermission) {
    return {
      allowed: false,
      minSolutionLevelForUser,
      userLevel: null,
      appliesUserLevelPolicy: false,
      reason: "permission_denied",
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, communityScore: true },
  });
  const isGeneralUser = (currentUser?.role ?? user.role) === "USER";
  const userLevel = getLevelFromScore(currentUser?.communityScore ?? 0);

  if (!isGeneralUser) {
    return {
      allowed: true,
      minSolutionLevelForUser,
      userLevel,
      appliesUserLevelPolicy: false,
      reason: "ok",
    };
  }

  const allowed = userLevel >= minSolutionLevelForUser;
  return {
    allowed,
    minSolutionLevelForUser,
    userLevel,
    appliesUserLevelPolicy: true,
    reason: allowed ? "ok" : "level_too_low",
  };
}
