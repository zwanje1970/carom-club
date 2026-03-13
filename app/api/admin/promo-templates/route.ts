import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  DEFAULT_PROMO_TEMPLATES,
  type PromoPageTemplateRow,
} from "@/lib/promo-templates";

/** 기본 템플릿이 DB에 없으면 삽입 (이름+카테고리 기준) */
async function ensureDefaultTemplates() {
  for (const def of DEFAULT_PROMO_TEMPLATES) {
    const existing = await prisma.promoPageTemplate.findFirst({
      where: { name: def.name, category: def.category, isDefault: true },
    });
    if (!existing) {
      await prisma.promoPageTemplate.create({
        data: {
          name: def.name,
          description: def.description,
          category: def.category,
          contentHtml: def.contentHtml,
          isDefault: true,
        },
      });
    }
  }
}

/** GET: 템플릿 목록 (기본 템플릿 보장 후 반환) */
export async function GET() {
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

  try {
    await ensureDefaultTemplates();
    const rows = await prisma.promoPageTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { category: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        thumbnailUrl: true,
        contentHtml: true,
        isDefault: true,
        createdById: true,
        createdAt: true,
      },
    });
    const list: PromoPageTemplateRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      thumbnailUrl: r.thumbnailUrl,
      contentHtml: r.contentHtml,
      isDefault: r.isDefault,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json(list);
  } catch (e) {
    console.error("[promo-templates] GET error:", e);
    return NextResponse.json(
      { error: "목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** POST: 현재 페이지를 템플릿으로 저장 (관리자 전용) */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { name: string; description?: string; category: string; contentHtml: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const name = body.name?.trim();
  const category = (body.category?.trim() || "CUSTOM").toUpperCase();
  const contentHtml = typeof body.contentHtml === "string" ? body.contentHtml : "";
  if (!name) {
    return NextResponse.json({ error: "템플릿 이름을 입력해 주세요." }, { status: 400 });
  }

  try {
    const created = await prisma.promoPageTemplate.create({
      data: {
        name,
        description: body.description?.trim() || null,
        category: ["VENUE_INTRO", "TOURNAMENT", "LESSON", "EVENT", "CUSTOM"].includes(category)
          ? category
          : "CUSTOM",
        contentHtml: contentHtml || "<p></p>",
        isDefault: false,
        createdById: session.id,
      },
    });
    return NextResponse.json({
      id: created.id,
      name: created.name,
      description: created.description,
      category: created.category,
      thumbnailUrl: created.thumbnailUrl,
      isDefault: created.isDefault,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[promo-templates] POST error:", e);
    return NextResponse.json(
      { error: "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
