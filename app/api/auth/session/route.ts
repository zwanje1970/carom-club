import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getLegacyFallbackPermissions,
  PERMISSION_KEYS,
  type PermissionSubject,
} from "@/lib/auth/permissions";

async function getSessionPermissions(
  session: PermissionSubject
) {
  if (!session) return [];
  if (!session.roleId) {
    return getLegacyFallbackPermissions(session.role);
  }

  const { getUserResolvedPermissions } = await import(
    "@/lib/auth/permissions.server"
  );
  return getUserResolvedPermissions(session);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const permissions = await getSessionPermissions(session);
  return NextResponse.json({
    user: {
      ...session,
      permissions,
      canAccessAdmin: permissions.includes(PERMISSION_KEYS.ADMIN_ACCESS),
    },
  });
}
