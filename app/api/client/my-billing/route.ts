import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { getMyBillingData } from "@/lib/billing-client";

/** GET: 자기 조직의 요금/구독/기능 상태. CLIENT_ADMIN, 자기 org만. 화면 친화적 구조. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속 업체가 없습니다." }, { status: 404 });
  }

  const data = await getMyBillingData(orgId);
  if (!data) return NextResponse.json({ error: "조직을 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json(data);
}
