import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureRbacBootstrap } from "@/lib/rbac-bootstrap";
import {
  PERMISSION_KEYS,
  hasAllPermissions,
} from "@/lib/auth/permissions.server";

export async function GET() {
  try {
    const session = await getSession();
    if (
      !session ||
      !(await hasAllPermissions(session, [
        PERMISSION_KEYS.ADMIN_ACCESS,
        PERMISSION_KEYS.ADMIN_ROLE_MANAGE,
      ]))
    ) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await ensureRbacBootstrap();

    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { key: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
        isSystem: true,
        _count: {
          select: {
            users: true,
            rolePermissions: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: roles.map((role) => ({
        id: role.id,
        key: role.key,
        label: role.label,
        description: role.description ?? null,
        isSystem: role.isSystem,
        userCount: role._count.users,
        permissionCount: role._count.rolePermissions,
      })),
    });
  } catch (error) {
    console.error("[admin/rbac/roles] GET error:", error);
    return NextResponse.json({ error: "레벨 조회 실패" }, { status: 500 });
  }
}
