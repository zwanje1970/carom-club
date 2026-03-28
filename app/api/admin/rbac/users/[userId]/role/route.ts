import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { getSuggestedRoleByPoints } from "@/lib/activity-point-service";
import {
  PERMISSION_KEYS,
  hasAllPermissions,
} from "@/lib/auth/permissions.server";

export async function PATCH(
  request: Request,
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
    if (!userId) {
      return NextResponse.json({ error: "대상 회원이 필요합니다." }, { status: 400 });
    }

    let body: { targetRoleId?: string; roleManualLocked?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const targetRoleId = body.targetRoleId?.trim();
    const hasManualLockInput = typeof body.roleManualLocked === "boolean";
    if (!targetRoleId && !hasManualLockInput) {
      return NextResponse.json({ error: "targetRoleId 또는 roleManualLocked가 필요합니다." }, { status: 400 });
    }

    const [targetUser, targetRole] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          roleId: true,
          roleManualLocked: true,
          activityPoint: true,
          rbacRole: {
            select: { id: true, key: true, label: true },
          },
        },
      }),
      targetRoleId
        ? prisma.role.findUnique({
            where: { id: targetRoleId },
            select: { id: true, key: true, label: true },
          })
        : Promise.resolve(null),
    ]);

    if (!targetUser) {
      return NextResponse.json({ error: "대상 회원을 찾을 수 없습니다." }, { status: 404 });
    }
    if (targetRoleId && !targetRole) {
      return NextResponse.json({ error: "대상 레벨(Role)을 찾을 수 없습니다." }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(targetRole ? { roleId: targetRole.id } : {}),
        ...(hasManualLockInput ? { roleManualLocked: body.roleManualLocked } : {}),
      },
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

    const suggestedRole = getSuggestedRoleByPoints(updatedUser.activityPoint ?? 0);

    await createAdminLog({
      adminId: session.id,
      actionType: "update",
      targetType: "user_role",
      targetId: userId,
      beforeValue: JSON.stringify({
        userId: targetUser.id,
        username: targetUser.username,
        legacyRole: targetUser.role,
        roleId: targetUser.roleId ?? null,
        roleKey: targetUser.rbacRole?.key ?? null,
        roleLabel: targetUser.rbacRole?.label ?? null,
        roleManualLocked: targetUser.roleManualLocked,
        activityPoint: targetUser.activityPoint ?? 0,
      }),
      afterValue: JSON.stringify({
        userId: updatedUser.id,
        legacyRole: updatedUser.role,
        roleId: updatedUser.roleId ?? null,
        roleKey: updatedUser.rbacRole?.key ?? null,
        roleLabel: updatedUser.rbacRole?.label ?? null,
        roleManualLocked: updatedUser.roleManualLocked,
        activityPoint: updatedUser.activityPoint ?? 0,
        suggestedRoleKey: suggestedRole.roleKey,
      }),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updatedUser.id,
        legacyRole: updatedUser.role,
        roleId: updatedUser.roleId ?? null,
        roleKey: updatedUser.rbacRole?.key ?? null,
        roleLabel: updatedUser.rbacRole?.label ?? null,
        roleManualLocked: updatedUser.roleManualLocked,
        activityPoint: updatedUser.activityPoint ?? 0,
        suggestedRoleKey: suggestedRole.roleKey,
        suggestedRoleLabel: suggestedRole.label,
      },
    });
  } catch (error) {
    console.error("[admin/rbac/users/role] PATCH error:", error);
    return NextResponse.json(
      { error: "레벨 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
