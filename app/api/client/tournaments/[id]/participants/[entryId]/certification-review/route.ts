import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  parseVerificationMode,
  requiresVerificationImage,
} from "@/lib/tournament-certification";

/** 클라이언트 콘솔: 인증 이미지 검토 승인/반려 (OCR 자동 확정 아님) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: tournamentId, entryId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : null;
  if (!action) {
    return NextResponse.json({ error: "action은 approve 또는 reject 여야 합니다." }, { status: 400 });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, organizationId: gate.organizationId },
    select: { verificationMode: true, certificationRequestMode: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  const verificationMode = parseVerificationMode(
    tournament.verificationMode ?? tournament.certificationRequestMode
  );
  if (!requiresVerificationImage(verificationMode)) {
    return NextResponse.json({ error: "이 대회는 인증 검토 대상이 아닙니다." }, { status: 400 });
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
    select: {
      id: true,
      verificationImageUrl: true,
      certificationImageUrl: true,
    },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!(entry.verificationImageUrl || entry.certificationImageUrl)) {
    return NextResponse.json({ error: "인증 이미지가 없는 신청입니다." }, { status: 400 });
  }

  try {
    await prisma.tournamentEntry.update({
      where: { id: entryId },
      data: {
        verificationReviewStatus: action === "approve" ? "APPROVED" : "REJECTED",
        certificationReviewStatus: action === "approve" ? "approved" : "rejected",
        certificationReviewedAt: new Date(),
        certificationReviewedById: session.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[certification-review]", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
