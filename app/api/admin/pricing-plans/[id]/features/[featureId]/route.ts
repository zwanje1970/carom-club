import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** DELETE: 요금제-기능 연결 제거. PLATFORM_ADMIN */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; featureId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id, featureId } = await params;
  const pf = await prisma.planFeature.findUnique({
    where: { planId_featureId: { planId: id, featureId } },
  });
  if (!pf) return NextResponse.json({ error: "연결을 찾을 수 없습니다." }, { status: 404 });
  await prisma.planFeature.delete({ where: { id: pf.id } });
  return NextResponse.json({ ok: true });
}
