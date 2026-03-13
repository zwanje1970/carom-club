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
  const { draft, publish } = body as { draft?: string; publish?: string };

  try {
    if (publish !== undefined) {
      await prisma.tournament.update({
        where: { id },
        data: {
          outlinePublished: publish,
          outlinePublishedAt: new Date(),
          outlineDraft: publish,
        },
      });
      return NextResponse.json({ ok: true, published: true });
    }
    if (draft !== undefined) {
      await prisma.tournament.update({
        where: { id },
        data: { outlineDraft: draft },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "draft 또는 publish 값을 보내주세요." },
      { status: 400 }
    );
  } catch (e) {
    console.error("outline update error", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
