import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { ensureRbacBootstrap } from "@/lib/rbac-bootstrap";
import {
  PERMISSION_KEYS,
  hasAllPermissions,
} from "@/lib/auth/permissions.server";

async function canReadRolePermissions() {
  const session = await getSession();
  if (
    !session ||
    !(await hasAllPermissions(session, [
      PERMISSION_KEYS.ADMIN_ACCESS,
      PERMISSION_KEYS.ADMIN_ROLE_MANAGE,
    ]))
  ) {
    return { session, allowed: false as const };
  }
  return { session, allowed: true as const };
}

type RoleSummary = {
  id: string;
  key: string;
  label: string;
  isSystem: boolean;
};

type RolePermissionItem = {
  id: string;
  key: string;
  label: string;
  category: string;
};

type ExistingRolePermissionRow = {
  permissionId: string;
  key: string;
};

async function loadRole(roleId: string) {
  return prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      key: true,
      label: true,
      isSystem: true,
    },
  });
}

async function loadSelectedPermissions(roleId: string): Promise<RolePermissionItem[]> {
  const rows = await prisma.$queryRaw<RolePermissionItem[]>`
    SELECT
      p."id" AS "id",
      p."key" AS "key",
      p."label" AS "label",
      p."category" AS "category"
    FROM "RolePermission" rp
    INNER JOIN "Permission" p
      ON p."id" = rp."permissionId"
    WHERE rp."roleId" = ${roleId}
    ORDER BY p."key" ASC
  `;

  return Array.isArray(rows) ? rows : [];
}

async function loadExistingRolePermissions(roleId: string): Promise<ExistingRolePermissionRow[]> {
  const rows = await prisma.$queryRaw<ExistingRolePermissionRow[]>`
    SELECT
      rp."permissionId" AS "permissionId",
      p."key" AS "key"
    FROM "RolePermission" rp
    INNER JOIN "Permission" p
      ON p."id" = rp."permissionId"
    WHERE rp."roleId" = ${roleId}
  `;

  return Array.isArray(rows) ? rows : [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const auth = await canReadRolePermissions();
    if (!auth.allowed) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await ensureRbacBootstrap();

    const { roleId } = await params;
    const [role, allPermissions, selectedPermissions] = await Promise.all([
      loadRole(roleId),
      prisma.permission.findMany({
        orderBy: [{ category: "asc" }, { key: "asc" }],
        select: {
          id: true,
          key: true,
          label: true,
          category: true,
        },
      }),
      loadSelectedPermissions(roleId),
    ]);
    if (!role) {
      return NextResponse.json({ error: "레벨(Role)을 찾을 수 없습니다." }, { status: 404 });
    }

    const data = Array.isArray(allPermissions) ? allPermissions : [];
    console.log("permissions result:", data);

    return NextResponse.json({
      data,
      role: {
        id: role.id,
        key: role.key,
        label: role.label,
        isSystem: role.isSystem,
      },
      permissions: selectedPermissions,
      permissionKeys: selectedPermissions.map((item) => item.key),
      allPermissions: data,
    }, { status: 200 });
  } catch (error) {
    console.error("[admin/rbac/roles/permissions] GET error:", error);
    return NextResponse.json(
      {
        error: "권한 목록을 불러올 수 없습니다.",
        role: null,
        permissions: [],
        permissionKeys: [],
        allPermissions: [],
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const session = await getSession();
    if (
      !session ||
      !(await hasAllPermissions(session, [
        PERMISSION_KEYS.ADMIN_ACCESS,
        PERMISSION_KEYS.ADMIN_PERMISSION_MANAGE,
      ]))
    ) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { roleId } = await params;

    let body: { permissionKeys?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    if (!Array.isArray(body.permissionKeys)) {
      return NextResponse.json({ error: "permissionKeys 배열이 필요합니다." }, { status: 400 });
    }

    await ensureRbacBootstrap();

    const requestedKeys = [...new Set(body.permissionKeys.map((key) => String(key).trim()).filter(Boolean))];
    const [role, permissionRows, existingRows] = await Promise.all([
      loadRole(roleId),
      prisma.permission.findMany({
        where: { key: { in: requestedKeys } },
        select: { id: true, key: true },
      }),
      loadExistingRolePermissions(roleId),
    ]);

    if (!role) {
      return NextResponse.json({ error: "레벨(Role)을 찾을 수 없습니다." }, { status: 404 });
    }

    const foundKeys = new Set(permissionRows.map((row) => row.key));
    const missingKeys = requestedKeys.filter((key) => !foundKeys.has(key));
    if (missingKeys.length > 0) {
      return NextResponse.json(
        { error: "존재하지 않는 권한이 포함되어 있습니다.", missingKeys },
        { status: 400 }
      );
    }

    const targetPermissionIds = new Set(permissionRows.map((row) => row.id));
    const existingPermissionIds = new Set(existingRows.map((row) => row.permissionId));

    const addedPermissionKeys = permissionRows
      .filter((row) => !existingPermissionIds.has(row.id))
      .map((row) => row.key)
      .sort();
    const removedPermissionIds = existingRows
      .filter((row) => !targetPermissionIds.has(row.permissionId))
      .map((row) => row.permissionId);
    const removedPermissionKeys = existingRows
      .filter((row) => !targetPermissionIds.has(row.permissionId))
      .map((row) => row.key)
      .sort();

    await prisma.$transaction(async (tx) => {
      if (removedPermissionKeys.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { in: removedPermissionIds },
          },
        });
      }

      if (addedPermissionKeys.length > 0) {
        const addedRows = permissionRows.filter((row) => addedPermissionKeys.includes(row.key));
        await Promise.all(
          addedRows.map((row) =>
            tx.$executeRaw`
              INSERT INTO "RolePermission" ("roleId", "permissionId")
              VALUES (${roleId}, ${row.id})
              ON CONFLICT ("roleId", "permissionId") DO NOTHING
            `
          )
        );
      }
    });

    await createAdminLog({
      adminId: session.id,
      actionType: "update",
      targetType: "role_permission",
      targetId: roleId,
      beforeValue: JSON.stringify({
        roleId: role.id,
        roleKey: role.key,
        previousPermissionKeys: existingRows.map((row) => row.key).sort(),
      }),
      afterValue: JSON.stringify({
        roleId: role.id,
        roleKey: role.key,
        permissionKeys: requestedKeys.slice().sort(),
        addedPermissionKeys,
        removedPermissionKeys,
      }),
    });

    const updatedPermissions = await loadSelectedPermissions(roleId);
    return NextResponse.json({
      ok: true,
      role: {
        id: role.id,
        key: role.key,
        label: role.label,
        isSystem: role.isSystem,
      },
      permissions: updatedPermissions,
      addedPermissionKeys,
      removedPermissionKeys,
    }, { status: 200 });
  } catch (error) {
    console.error("[admin/rbac/roles/permissions] PATCH error:", error);
    return NextResponse.json(
      { error: "권한 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
