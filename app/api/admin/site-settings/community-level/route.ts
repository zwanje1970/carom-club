import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings } from "@/lib/site-settings";
import { hasAllPermissions, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

function clampLevel(value: unknown): number {
  return Math.min(15, Math.max(1, Math.floor(Number(value)) || 1));
}

export async function GET() {
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

  const settings = await getSiteSettings();
  return NextResponse.json({
    minSolutionLevelForUser: clampLevel(settings.minSolutionLevelForUser),
  });
}

export async function PATCH(request: Request) {
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

  let body: { minSolutionLevelForUser?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const minSolutionLevelForUser = clampLevel(body.minSolutionLevelForUser);
  try {
    const settings = await updateSiteSettings({ minSolutionLevelForUser });
    revalidateTag("site-settings");
    revalidateTag("common-page-data");
    return NextResponse.json({
      minSolutionLevelForUser: clampLevel(settings.minSolutionLevelForUser),
    });
  } catch (error) {
    console.error("[admin/site-settings/community-level] PATCH error:", error);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }
}
