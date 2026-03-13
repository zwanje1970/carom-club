import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function POST(
  request: Request,
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

  const { entryId } = await params;
  const body = await request.json();
  const { attended } = body as { attended: boolean };

  const entry = await prisma.tournamentEntry.findUnique({
    where: { id: entryId },
    include: { attendances: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.status !== "CONFIRMED") {
    return NextResponse.json({ error: "참가 확정된 참가자만 출석 체크할 수 있습니다." }, { status: 400 });
  }

  try {
    const existing = entry.attendances[0];
    if (existing) {
      await prisma.tournamentAttendance.update({
        where: { id: existing.id },
        data: { attended },
      });
    } else {
      await prisma.tournamentAttendance.create({
        data: {
          entryId: entry.id,
          userId: entry.userId,
          attended,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("attendance error", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
