import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";

type ReorderBody = {
  action: "reorder";
  orderedIds: string[];
};

type UpdateBody = {
  action: "update";
  id: string;
  slug?: string;
  name?: string;
  description?: string | null;
  type?: string;
  isActive?: boolean;
};

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function guardAdmin() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") return false;
  return true;
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const boards = await prisma.communityBoard.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json(
    boards.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      type: b.type,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      postCount: b._count.posts,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }))
  );
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: {
    slug?: string;
    name?: string;
    description?: string | null;
    type?: string;
    isActive?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const slug = toSlug(String(body.slug ?? ""));
  if (!name) {
    return NextResponse.json({ error: "게시판 이름을 입력하세요." }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "게시판 슬러그를 입력하세요." }, { status: 400 });
  }
  const exists = await prisma.communityBoard.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json({ error: "이미 사용 중인 슬러그입니다." }, { status: 409 });
  }
  const maxSort = await prisma.communityBoard.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.communityBoard.create({
    data: {
      slug,
      name,
      description: body.description?.trim() || null,
      type: String(body.type ?? "free").trim() || "free",
      isActive: body.isActive !== false,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(created);
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: ReorderBody | UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (body.action === "reorder") {
    if (!Array.isArray(body.orderedIds) || body.orderedIds.length === 0) {
      return NextResponse.json({ error: "정렬 정보가 올바르지 않습니다." }, { status: 400 });
    }
    await prisma.$transaction(
      body.orderedIds.map((id, i) =>
        prisma.communityBoard.update({
          where: { id },
          data: { sortOrder: i },
        })
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "게시판 ID가 필요합니다." }, { status: 400 });
    }
    const existing = await prisma.communityBoard.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
    }
    const nextSlug = body.slug !== undefined ? toSlug(body.slug) : existing.slug;
    if (!nextSlug) {
      return NextResponse.json({ error: "슬러그 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (nextSlug !== existing.slug) {
      const dup = await prisma.communityBoard.findUnique({ where: { slug: nextSlug } });
      if (dup) return NextResponse.json({ error: "이미 사용 중인 슬러그입니다." }, { status: 409 });
    }
    const updated = await prisma.communityBoard.update({
      where: { id },
      data: {
        slug: nextSlug,
        name: body.name !== undefined ? String(body.name).trim() || existing.name : undefined,
        description: body.description !== undefined ? body.description?.trim() || null : undefined,
        type: body.type !== undefined ? String(body.type).trim() || existing.type : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  if (!(await guardAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "게시판 ID가 필요합니다." }, { status: 400 });
  }
  const board = await prisma.communityBoard.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });
  if (!board) {
    return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  }
  if (board._count.posts > 0) {
    return NextResponse.json(
      { error: "게시글이 있는 게시판은 삭제할 수 없습니다. 노출을 끄거나 게시글을 먼저 정리하세요." },
      { status: 409 }
    );
  }
  await prisma.communityBoard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
