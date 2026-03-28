import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRecentUserActivityPoints, getSuggestedRoleByPoints } from "@/lib/activity-point-service";
import { PERMISSION_KEYS, hasAllPermissions } from "@/lib/auth/permissions.server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (
      !session ||
      !(await hasAllPermissions(session, [
        PERMISSION_KEYS.ADMIN_ACCESS,
        PERMISSION_KEYS.ADMIN_USER_MANAGE,
      ]))
    ) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { userId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        activityPoint: true,
        roleManualLocked: true,
        rbacRole: {
          select: { key: true, label: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "대상 회원을 찾을 수 없습니다." }, { status: 404 });
    }

    const suggestedRole = getSuggestedRoleByPoints(user.activityPoint ?? 0);
    const recentPoints = await getRecentUserActivityPoints(userId, 10);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        activityPoint: user.activityPoint ?? 0,
        roleManualLocked: user.roleManualLocked,
        currentRoleKey: user.rbacRole?.key ?? null,
        currentRoleLabel: user.rbacRole?.label ?? null,
        suggestedRoleKey: suggestedRole.roleKey,
        suggestedRoleLabel: suggestedRole.label,
      },
      recentPoints,
    });
  } catch (error) {
    console.error("[admin/rbac/users/activity-points] GET error:", error);
    return NextResponse.json(
      { error: "점수 이력을 불러올 수 없습니다.", user: null, recentPoints: [] },
      { status: 500 }
    );
  }
}
