/** GET/PATCH: 클라이언트 로그인 모드 — 본인 업체의 홍보 페이지(초안·게시) 조회·수정 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { createListingPurchaseRecord } from "@/lib/listing-registration";
import { canAccessClientDashboard } from "@/types/auth";

export async function GET() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 404 });
  }
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      promoDraft: true,
      promoPublished: true,
      promoPublishedAt: true,
    },
  });
  if (!org) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    organizationId: org.id,
    organizationName: org.name,
    promoDraft: org.promoDraft ?? "",
    promoPublished: org.promoPublished ?? "",
    promoPublishedAt: org.promoPublishedAt?.toISOString() ?? null,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "소속된 업체가 없습니다." }, { status: 404 });
  }
  const body = await request.json();
  const { draft, publish, promoPdfUrl, promoImageUrl } = body as {
    draft?: string;
    publish?: string;
    promoPdfUrl?: string | null;
    promoImageUrl?: string | null;
  };

  try {
    if (publish !== undefined) {
      const updateData: Record<string, unknown> = {
        promoPublished: publish,
        promoPublishedAt: new Date(),
        promoDraft: publish,
      };
      if (promoPdfUrl !== undefined) updateData.promoPdfUrl = promoPdfUrl;
      if (promoImageUrl !== undefined) updateData.promoImageUrl = promoImageUrl;
      await prisma.organization.update({
        where: { id: orgId },
        data: updateData as Parameters<typeof prisma.organization.update>[0]["data"],
      });
      await createListingPurchaseRecord({
        organizationId: orgId,
        listingCode: "VENUE_PROMOTION",
        targetType: "VENUE_PROMO",
        targetId: orgId,
      });
      return NextResponse.json({ ok: true, published: true });
    }
    if (draft !== undefined || promoPdfUrl !== undefined || promoImageUrl !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (draft !== undefined) updateData.promoDraft = draft;
      if (promoPdfUrl !== undefined) updateData.promoPdfUrl = promoPdfUrl;
      if (promoImageUrl !== undefined) updateData.promoImageUrl = promoImageUrl;
      await prisma.organization.update({
        where: { id: orgId },
        data: updateData as Parameters<typeof prisma.organization.update>[0]["data"],
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "draft, publish, promoPdfUrl, promoImageUrl 중 하나 이상을 보내주세요." },
      { status: 400 }
    );
  } catch (e) {
    console.error("client organization promo update error", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
