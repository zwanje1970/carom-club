import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { nameToSlug, ensureUniqueSlug } from "@/lib/slug";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { name?: string; slug?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "당구장명을 입력해주세요." },
      { status: 400 }
    );
  }

  const slug = body.slug?.trim()
    ? nameToSlug(body.slug)
    : await ensureUniqueSlug(nameToSlug(name), (s) =>
        prisma.organization.findUnique({ where: { slug: s } }).then(Boolean)
      );
  if (!slug || (body.slug?.trim() && slug === "org")) {
    return NextResponse.json(
      { error: "slug를 입력해주세요. (영문 소문자, 숫자, 하이픈만 가능)" },
      { status: 400 }
    );
  }
  if (body.slug?.trim()) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json(
        { error: "이미 사용 중인 slug입니다. 다른 값을 사용해주세요." },
        { status: 400 }
      );
    }
  }

  const description = body.description?.trim() || null;

  try {
    const venue = await prisma.organization.create({
      data: {
        name,
        slug,
        type: "VENUE",
        description,
      },
    });
    return NextResponse.json(venue);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const isSchemaMismatch =
      err.code === "P2022" ||
      (typeof err.message === "string" &&
        (err.message.includes("does not exist") || err.message.includes("column")));

    if (isSchemaMismatch) {
      // DB에 Organization 컬럼이 스키마보다 적을 때: init 수준 컬럼만으로 생성
      try {
        const id = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Organization" (id, slug, name, type, description, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'VENUE', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          id,
          slug,
          name,
          description
        );
        const inserted = await prisma.$queryRawUnsafe<{ id: string; slug: string; name: string; type: string; description: string | null }[]>(
          `SELECT id, slug, name, type, description FROM "Organization" WHERE id = $1`,
          id
        );
        return NextResponse.json(inserted[0] ?? { id, slug, name, type: "VENUE", description });
      } catch (rawErr) {
        console.error("[admin/venues] raw create error:", rawErr);
        return NextResponse.json(
          { error: "당구장 생성에 실패했습니다. DB 스키마를 마이그레이션해 주세요." },
          { status: 500 }
        );
      }
    }
    console.error("[admin/venues] create error:", e);
    return NextResponse.json(
      { error: "당구장 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
