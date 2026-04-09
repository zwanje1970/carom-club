import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { fillAdminCopyTemplate, getCopyValue } from "@/lib/admin-copy";
import { getTournamentBasic, getTournamentEntries } from "@/lib/db-tournaments";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  parseEligibilityType,
  parseVerificationMode,
} from "@/lib/tournament-certification";
import { TournamentApplySection } from "@/components/tournament/TournamentApplySection";

export default async function TournamentApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = isDatabaseConfigured() ? await getTournamentBasic(id) : null;
  if (!tournament) notFound();

  const [entries, session, copy] = await Promise.all([
    getTournamentEntries(id),
    getSession(),
    getAdminCopy(),
  ]);

  let userMemberAvg: string | null = null;
  let userPhone: string | null = null;
  if (session && isDatabaseConfigured()) {
    const u = await prisma.user.findUnique({
      where: { id: session.id },
      include: { memberProfile: true },
    });
    userMemberAvg = u?.memberProfile?.avg?.trim() || null;
    userPhone = u?.phone?.trim() || null;
  }

  const myEntries = session
    ? entries.filter((e) => e.userId === session.id).map((e) => ({
        id: e.id,
        status: e.status,
        waitingListOrder: e.waitingListOrder,
        paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
        slotNumber: e.slotNumber ?? 1,
      }))
    : [];

  const confirmedCount = entries.filter((e) => e.status === "CONFIRMED").length;
  type TournamentBasic = {
    name: string;
    status: string;
    entryFee?: number | null;
    maxParticipants?: number | null;
    rule?: {
      maxEntries?: number | null;
      useWaiting?: boolean;
      bracketConfig?: string | null;
      entryConditions?: string | null;
      entryFee?: number | null;
    };
  };
  const t = tournament as unknown as TournamentBasic;
  const maxCap = t.maxParticipants ?? t.rule?.maxEntries ?? 0;
  const isFull = maxCap > 0 && confirmedCount >= maxCap;
  const useWaiting = t.rule?.useWaiting ?? false;
  const activeEntries = myEntries.filter((e) => e.status !== "CANCELED");

  const accountNumber = (() => {
    try {
      const bc = t.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      const v = (raw as Record<string, unknown>)?.accountNumber;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  })();

  const allowMultipleSlots = (() => {
    try {
      const bc = t.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      return (raw as Record<string, unknown>)?.allowMultipleSlots === true;
    } catch {
      return false;
    }
  })();

  const entryQualificationLabels = (() => {
    try {
      const bc = t.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      const type = String((raw as Record<string, unknown> | null)?.entryQualificationType ?? "NONE");
      if (type === "SCORE") return ["점수 기준"];
      if (type === "EVER") return ["에버 기준"];
      if (type === "BOTH") return ["점수 기준", "에버 기준"];
      return [];
    } catch {
      return [];
    }
  })();

  const canApplyFirstSlot =
    t.status === "OPEN" && (useWaiting || !isFull) && activeEntries.length === 0;
  const canApplyAdditionalSlot =
    t.status === "OPEN" && (useWaiting || !isFull) && allowMultipleSlots && activeEntries.length >= 1;

  const applyClosedReason =
    t.status === "DRAFT"
      ? "아직 참가 신청을 받지 않습니다."
      : t.status === "CLOSED"
        ? "참가 신청이 마감되었습니다."
        : t.status === "FINISHED"
          ? "종료된 대회입니다."
          : isFull && !useWaiting
            ? "정원이 마감되었습니다."
            : null;

  const entryFee = t.entryFee ?? t.rule?.entryFee ?? null;

  const tCert = tournament as typeof tournament & {
    verificationMode?: string;
    verificationGuideText?: string | null;
    divisionEnabled?: boolean;
    eligibilityType?: string | null;
    eligibilityValue?: number | null;
    isScotch?: boolean;
    teamScoreLimit?: number | null;
    teamScoreRule?: "LTE" | "LT" | null;
    // 구 필드 fallback
    certificationRequestMode?: string;
    eligibilityLimitType?: string | null;
    eligibilityLimitValue?: number | null;
  };
  const verificationMode = parseVerificationMode(tCert.verificationMode ?? tCert.certificationRequestMode);
  const eligibilityType = parseEligibilityType(
    tCert.eligibilityType ?? (tCert.eligibilityLimitType === "UNDER" ? "UNDER" : "NONE")
  );
  const eligibilityValue =
    tCert.eligibilityValue != null && Number.isFinite(Number(tCert.eligibilityValue))
      ? Number(tCert.eligibilityValue)
      : tCert.eligibilityLimitValue != null && Number.isFinite(Number(tCert.eligibilityLimitValue))
        ? Number(tCert.eligibilityLimitValue)
      : null;
  const eligibilityLine =
    eligibilityType === "UNDER" && eligibilityValue != null
      ? fillAdminCopyTemplate(getCopyValue(copy, "site.tournament.apply.eligibilityUnderLine"), {
          value: String(eligibilityValue),
        })
      : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/tournaments/${id}`}
          className="text-sm text-site-text-muted hover:text-site-primary inline-block mb-6"
        >
          ← 대회 안내
        </Link>

        <h1 className="text-xl sm:text-2xl font-bold text-site-text mb-6">{t.name}</h1>

        <TournamentApplySection
          tournamentId={id}
          entryFee={entryFee}
          accountNumber={accountNumber}
          entryConditionsHtml={t.rule?.entryConditions ?? null}
          entryQualificationLabels={entryQualificationLabels}
          isLoggedIn={!!session}
          myEntries={myEntries}
          canApplyFirstSlot={canApplyFirstSlot}
          canApplyAdditionalSlot={canApplyAdditionalSlot}
          applyClosedReason={applyClosedReason}
          verificationMode={verificationMode}
          verificationGuideText={tCert.verificationGuideText ?? null}
          divisionEnabled={tCert.divisionEnabled === true}
          eligibilityLine={eligibilityLine}
          userMemberAvg={userMemberAvg}
          currentUserName={session?.name ?? null}
          currentUserPhone={userPhone}
          isScotch={tCert.isScotch === true}
          teamScoreLimit={tCert.teamScoreLimit ?? null}
          teamScoreRule={tCert.teamScoreRule ?? "LTE"}
        />
      </div>
    </main>
  );
}
