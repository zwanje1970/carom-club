import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    draft,
    publish,
    promoPdfUrl,
    promoImageUrl,
  } = body as {
    draft?: string;
    publish?: string;
    promoPdfUrl?: string | null;
    promoImageUrl?: string | null;
  };

  const org = await prisma.organization.findFirst({
    where: { id, type: "VENUE" },
  });
  if (!org) {
    return NextResponse.json({ error: "당구장을 찾을 수 없습니다." }, { status: 404 });
  }

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
        where: { id },
        data: updateData as Parameters<typeof prisma.organization.update>[0]["data"],
      });
      return NextResponse.json({ ok: true, published: true });
    }
    if (draft !== undefined || promoPdfUrl !== undefined || promoImageUrl !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (draft !== undefined) updateData.promoDraft = draft;
      if (promoPdfUrl !== undefined) updateData.promoPdfUrl = promoPdfUrl;
      if (promoImageUrl !== undefined) updateData.promoImageUrl = promoImageUrl;
      await prisma.organization.update({
        where: { id },
        data: updateData as Parameters<typeof prisma.organization.update>[0]["data"],
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "draft, publish, promoPdfUrl, promoImageUrl 중 하나 이상을 보내주세요." },
      { status: 400 }
    );
  } catch (e) {
    console.error("promo update error", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
