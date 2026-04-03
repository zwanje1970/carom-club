import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getDisplayName } from "@/lib/display-name";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";
import {
  parseVerificationOcrStatus,
  parseVerificationReviewStatus,
} from "@/lib/tournament-certification";

/** 클라 콘솔: 조직 소속 대회 참가자 목록 (JSON) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, organizationId: gate.organizationId },
    select: {
      id: true,
      name: true,
      maxParticipants: true,
      status: true,
      participantRosterLockedAt: true,
      verificationMode: true,
      verificationReviewRequired: true,
      divisionEnabled: true,
      divisionMetricType: true,
      divisionRulesJson: true,
      isScotch: true,
      certificationRequestMode: true,
      manualReviewRequired: true,
      rule: { select: { maxEntries: true, useWaiting: true } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    include: {
      user: { include: { memberProfile: true } },
      attendances: true,
    },
    orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }],
  });

  const rows = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: getDisplayName(e.user),
    userPhone: e.user.phone ?? null,
    userEmail: e.user.email ?? null,
    handicap: e.handicap ?? e.user.memberProfile?.handicap ?? null,
    avg: e.avg ?? e.user.memberProfile?.avg ?? null,
    avgProofUrl: e.avgProofUrl ?? e.user.memberProfile?.avgProofUrl ?? null,
    depositorName: e.depositorName,
    clubOrAffiliation: e.clubOrAffiliation ?? null,
    displayName: formatTournamentEntryDisplayName({
      displayName: e.displayName,
      playerAName: e.playerAName,
      playerBName: e.playerBName,
      user: e.user,
      slotNumber: e.slotNumber,
      isScotch: tournament.isScotch === true,
    }),
    playerAName: e.playerAName ?? null,
    playerAScore: e.playerAScore ?? null,
    playerAProof: e.playerAProof ?? null,
    playerBName: e.playerBName ?? null,
    playerBScore: e.playerBScore ?? null,
    playerBProof: e.playerBProof ?? null,
    teamTotalScore: e.teamTotalScore ?? null,
    round: e.round ?? null,
    status: e.status,
    waitingListOrder: e.waitingListOrder,
    slotNumber: e.slotNumber ?? 1,
    paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
    paidAt: e.paidAt?.toISOString() ?? null,
    reviewedAt: e.reviewedAt?.toISOString() ?? null,
    rejectionReason: e.rejectionReason ?? null,
    createdAt: e.createdAt.toISOString(),
    attended: e.attendances[0]?.attended ?? null,
    verificationImageUrl: e.verificationImageUrl ?? e.certificationImageUrl ?? null,
    verificationOcrText: e.verificationOcrText ?? e.certificationOcrText ?? null,
    verificationOcrStatus:
      e.verificationOcrStatus ?? parseVerificationOcrStatus(e.certificationOcrStatus) ?? null,
    verificationReviewStatus:
      e.verificationReviewStatus ?? parseVerificationReviewStatus(e.certificationReviewStatus) ?? null,
    divisionName: e.divisionName ?? null,
    divisionMatchedValue: e.divisionMatchedValue ?? e.divisionMatchedAverage ?? null,
    divisionMatchedAverage: e.divisionMatchedAverage ?? e.divisionMatchedValue ?? null,
    // 구 필드 (호환)
    certificationImageUrl: e.certificationImageUrl ?? null,
    certificationOriginalFilename: e.certificationOriginalFilename ?? null,
    certificationMimeType: e.certificationMimeType ?? null,
    certificationOcrText: e.certificationOcrText ?? null,
    certificationOcrStatus: e.certificationOcrStatus ?? null,
    certificationReviewStatus: e.certificationReviewStatus ?? null,
    certificationReviewedAt: e.certificationReviewedAt?.toISOString() ?? null,
    certificationReviewedById: e.certificationReviewedById ?? null,
  }));

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      maxParticipants: tournament.maxParticipants ?? tournament.rule?.maxEntries ?? null,
      useWaiting: tournament.rule?.useWaiting ?? false,
      tournamentStatus: tournament.status,
      participantRosterLockedAt: tournament.participantRosterLockedAt?.toISOString() ?? null,
      verificationMode: tournament.verificationMode ?? tournament.certificationRequestMode,
      verificationReviewRequired:
        tournament.verificationReviewRequired ?? tournament.manualReviewRequired,
      divisionEnabled: tournament.divisionEnabled === true,
      divisionMetricType: tournament.divisionMetricType ?? "AVERAGE",
      divisionRulesJson: tournament.divisionRulesJson ?? null,
    },
    entries: rows,
  });
}
