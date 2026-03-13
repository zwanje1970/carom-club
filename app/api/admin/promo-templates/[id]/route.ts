import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 템플릿 1건 조회 (불러오기 적용용 — contentHtml 포함) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.promoPageTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      contentHtml: true,
      isDefault: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    contentHtml: row.contentHtml,
    isDefault: row.isDefault,
  });
}
