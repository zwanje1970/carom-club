import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function POST(request: Request) {
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

  const body = await request.json();
  const { entryId } = body as { entryId?: string };
  if (!entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, userId: session.id },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  if (entry.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "참가 확정 후에는 취소할 수 없습니다. 문의는 관리자에게 해 주세요." },
      { status: 400 }
    );
  }
  if (entry.status === "CANCELED") {
    return NextResponse.json({ error: "이미 취소되었거나 불참 처리된 신청입니다." }, { status: 400 });
  }

  try {
    await prisma.tournamentEntry.update({
      where: { id: entryId },
      data: { status: "CANCELED" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("cancel error", e);
    return NextResponse.json(
      { error: "취소 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
