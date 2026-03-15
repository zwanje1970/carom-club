import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 신청자가 '입금 완료' 체크. 본인 신청만, APPLIED 상태이고 아직 체크 안 한 경우만 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> }
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

  const { entryId } = await params;

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, userId: session.id },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.status !== "APPLIED") {
    return NextResponse.json(
      { error: "신청 상태에서만 입금 완료를 표시할 수 있습니다." },
      { status: 400 }
    );
  }
  if (entry.paymentMarkedByApplicantAt != null) {
    return NextResponse.json(
      { error: "이미 입금 완료로 표시했습니다. 관리자 확인을 기다려 주세요." },
      { status: 400 }
    );
  }
  if (entry.paidAt != null) {
    return NextResponse.json(
      { error: "이미 입금 확인이 완료되었습니다." },
      { status: 400 }
    );
  }

  try {
    await prisma.tournamentEntry.update({
      where: { id: entryId },
      data: { paymentMarkedByApplicantAt: new Date() },
    });
    return NextResponse.json({
      ok: true,
      message: "입금 완료로 표시했습니다. 관리자 확인 후 참가가 확정됩니다.",
    });
  } catch (e) {
    console.error("mark-paid error", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
