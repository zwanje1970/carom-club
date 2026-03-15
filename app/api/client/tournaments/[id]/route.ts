import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";

/** GET: 클라이언트 로그인 모드일 때만 본인 소유 업체의 대회 1건 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const tournament = await prisma.tournament.findFirst({
    where: { id, organizationId: orgId },
    include: {
      matchVenues: { orderBy: { sortOrder: "asc" } },
      rule: true,
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(tournament);
}
