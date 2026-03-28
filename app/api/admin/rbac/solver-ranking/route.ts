import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSolverRanking } from "@/lib/activity-point-service";
import { PERMISSION_KEYS, hasAllPermissions } from "@/lib/auth/permissions.server";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const take = Math.max(1, Math.min(50, Number(searchParams.get("take")) || 10));
    const ranking = await getSolverRanking({ take });

    return NextResponse.json({ data: ranking ?? [] });
  } catch (error) {
    console.error("[admin/rbac/solver-ranking] GET error:", error);
    return NextResponse.json({ error: "랭킹 조회 실패" }, { status: 500 });
  }
}
