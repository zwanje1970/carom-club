import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** PATCH: 기능 수정. PLATFORM_ADMIN */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  let body: { code?: string; name?: string; description?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const existing = await prisma.feature.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "기능을 찾을 수 없습니다." }, { status: 404 });
  const data: { code?: string; name?: string; description?: string | null; isActive?: boolean } = {};
  if (typeof body?.code === "string" && body.code.trim()) data.code = body.code.trim();
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body?.description !== undefined) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  try {
    const feature = await prisma.feature.update({
      where: { id },
      data,
    });
    return NextResponse.json(feature);
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "이미 존재하는 code입니다." }, { status: 400 });
    throw e;
  }
}
