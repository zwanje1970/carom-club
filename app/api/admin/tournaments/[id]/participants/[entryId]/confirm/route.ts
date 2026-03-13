import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
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

  const { id: tournamentId, entryId } = await params;

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.status !== "APPLIED") {
    return NextResponse.json({ error: "신청됨 상태만 확정할 수 있습니다." }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.tournamentEntry.update({
        where: { id: entryId },
        data: { status: "CONFIRMED", paidAt: new Date() },
      }),
      prisma.notification.create({
        data: {
          userId: entry.userId,
          message: "참가비 입금이 확인되어 대회 참가가 확정되었습니다.",
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("confirm payment error", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
