import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

const TYPES = ["tournament", "venue", "post"] as const;

/** 목록 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }
  const list = await prisma.featuredContent.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });
  const items = await Promise.all(
    list.map(async (f) => {
      let title = f.targetId;
      if (f.type === "tournament") {
        const t = await prisma.tournament.findUnique({ where: { id: f.targetId }, select: { name: true } });
        title = t?.name ?? f.targetId;
      } else if (f.type === "venue") {
        const o = await prisma.organization.findUnique({ where: { id: f.targetId }, select: { name: true } });
        title = o?.name ?? f.targetId;
      } else if (f.type === "post") {
        const p = await prisma.communityPost.findUnique({ where: { id: f.targetId }, select: { title: true } });
        title = p?.title ?? f.targetId;
      }
      return { id: f.id, type: f.type, targetId: f.targetId, title, sortOrder: f.sortOrder, createdAt: f.createdAt.toISOString() };
    })
  );
  return NextResponse.json({ items });
}

/** 추가 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  let body: { type: string; targetId: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!TYPES.includes(body.type as (typeof TYPES)[number]) || !body.targetId?.trim()) {
    return NextResponse.json({ error: "type(tournament|venue|post)과 targetId가 필요합니다." }, { status: 400 });
  }
  try {
    const created = await prisma.featuredContent.create({
      data: {
        type: body.type,
        targetId: body.targetId.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ id: created.id, type: created.type, targetId: created.targetId, sortOrder: created.sortOrder });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "이미 추천 목록에 있습니다." }, { status: 400 });
    }
    throw e;
  }
}
