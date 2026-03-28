import "server-only";

import { prisma } from "@/lib/db";
import {
  ALL_PERMISSION_KEYS,
  dedupePermissionKeys,
  getLegacyFallbackPermissions,
  type PermissionKey,
  type PermissionSubject,
} from "@/lib/auth/permissions";

export * from "@/lib/auth/permissions";

type RolePermissionKeyRow = {
  roleKey: string;
  permissionKey: string | null;
};

async function getCurrentUserRoleState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roleId: true,
    },
  });
}

async function getPermissionsFromRole(
  whereClause: `"id" = $1` | `"key" = $1`,
  value: string
): Promise<PermissionKey[] | null> {
  const rows = await prisma.$queryRawUnsafe<RolePermissionKeyRow[]>(
    `
      SELECT
        r."key" AS "roleKey",
        p."key" AS "permissionKey"
      FROM "Role" r
      LEFT JOIN "RolePermission" rp
        ON rp."roleId" = r."id"
      LEFT JOIN "Permission" p
        ON p."id" = rp."permissionId"
      WHERE r.${whereClause}
    `,
    value
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const roleKey = rows[0]?.roleKey;
  if (roleKey === "ADMIN" || roleKey === "PLATFORM_ADMIN") {
    return ALL_PERMISSION_KEYS;
  }

  const permissionKeys = rows
    .map((row) => row.permissionKey)
    .filter((key): key is string => typeof key === "string");

  return dedupePermissionKeys(permissionKeys);
}

async function getPermissionsFromRoleId(roleId: string): Promise<PermissionKey[] | null> {
  return getPermissionsFromRole(`"id" = $1`, roleId);
}

async function getPermissionsFromRoleKey(roleKey: string): Promise<PermissionKey[] | null> {
  return getPermissionsFromRole(`"key" = $1`, roleKey);
}

export async function getUserResolvedPermissions(
  user: PermissionSubject
): Promise<PermissionKey[]> {
  if (!user) return [];

  const currentUserState = user.id ? await getCurrentUserRoleState(user.id) : null;
  const resolvedRole = currentUserState?.role ?? user.role;
  const resolvedRoleId =
    typeof currentUserState?.roleId === "string" ? currentUserState.roleId : user.roleId ?? null;

  if (resolvedRole === "PLATFORM_ADMIN") {
    return ALL_PERMISSION_KEYS;
  }

  if (resolvedRoleId) {
    const rolePermissions = await getPermissionsFromRoleId(resolvedRoleId);
    if (rolePermissions) {
      return rolePermissions;
    }
  }

  if (resolvedRole) {
    const rolePermissions = await getPermissionsFromRoleKey(resolvedRole);
    if (rolePermissions) {
      return rolePermissions;
    }
  }

  return getLegacyFallbackPermissions(resolvedRole);
}

export async function hasPermission(
  user: PermissionSubject,
  permissionKey: PermissionKey
): Promise<boolean> {
  if (!user) return false;
  const permissions = await getUserResolvedPermissions(user);
  return permissions.includes(permissionKey);
}

export async function hasAnyPermission(
  user: PermissionSubject,
  permissionKeys: PermissionKey[]
): Promise<boolean> {
  if (!user || permissionKeys.length === 0) return false;
  const permissions = new Set(await getUserResolvedPermissions(user));
  return permissionKeys.some((key) => permissions.has(key));
}

export async function hasAllPermissions(
  user: PermissionSubject,
  permissionKeys: PermissionKey[]
): Promise<boolean> {
  if (!user || permissionKeys.length === 0) return false;
  const permissions = new Set(await getUserResolvedPermissions(user));
  return permissionKeys.every((key) => permissions.has(key));
}
