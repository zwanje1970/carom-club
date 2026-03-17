import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTournamentBasic, getTournamentEntries } from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { TournamentApplySection } from "@/components/tournament/TournamentApplySection";

export default async function TournamentApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = isDatabaseConfigured() ? await getTournamentBasic(id) : null;
  if (!tournament) notFound();

  const [entries, session] = await Promise.all([
    getTournamentEntries(id),
    getSession(),
  ]);

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
  const maxCap = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const isFull = maxCap > 0 && confirmedCount >= maxCap;
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const activeEntries = myEntries.filter((e) => e.status !== "CANCELED");

  const accountNumber = (() => {
    try {
      const bc = tournament.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      const v = (raw as Record<string, unknown>)?.accountNumber;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    } catch {
      return null;
    }
  })();

  const allowMultipleSlots = (() => {
    try {
      const bc = tournament.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      return (raw as Record<string, unknown>)?.allowMultipleSlots === true;
    } catch {
      return false;
    }
  })();

  const canApplyFirstSlot =
    tournament.status === "OPEN" && (useWaiting || !isFull) && activeEntries.length === 0;
  const canApplyAdditionalSlot =
    tournament.status === "OPEN" && (useWaiting || !isFull) && allowMultipleSlots && activeEntries.length >= 1;

  const applyClosedReason =
    tournament.status === "DRAFT"
      ? "아직 참가 신청을 받지 않습니다."
      : tournament.status === "CLOSED"
        ? "참가 신청이 마감되었습니다."
        : tournament.status === "FINISHED"
          ? "종료된 대회입니다."
          : isFull && !useWaiting
            ? "정원이 마감되었습니다."
            : null;

  const entryFee = tournament.entryFee ?? tournament.rule?.entryFee ?? null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/tournaments/${id}`}
          className="text-sm text-site-text-muted hover:text-site-primary inline-block mb-6"
        >
          ← 대회 안내
        </Link>

        <h1 className="text-xl sm:text-2xl font-bold text-site-text mb-6">{tournament.name}</h1>

        <TournamentApplySection
          tournamentId={id}
          entryFee={entryFee}
          accountNumber={accountNumber}
          entryConditionsHtml={tournament.rule?.entryConditions ?? null}
          isLoggedIn={!!session}
          myEntries={myEntries}
          canApplyFirstSlot={canApplyFirstSlot}
          canApplyAdditionalSlot={canApplyAdditionalSlot}
          applyClosedReason={applyClosedReason}
        />
      </div>
    </main>
  );
}
