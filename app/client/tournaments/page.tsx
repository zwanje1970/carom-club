import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { ClientTournamentCards } from "./ClientTournamentCards";

export default async function ClientTournamentsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">대회 관리</h1>
        <p className="text-gray-600">먼저 업체 설정을 완료해 주세요.</p>
        <Link href="/client/setup" className="inline-block rounded-lg bg-site-primary px-4 py-2 text-white hover:opacity-90">
          업체 설정
        </Link>
      </div>
    );
  }

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: { startAt: "desc" },
    include: {
      organization: { select: { name: true } },
      _count: { select: { entries: true } },
    },
  });

  const ids = tournaments.map((t) => t.id);
  const confirmedByTournament =
    ids.length > 0
      ? await prisma.tournamentEntry.groupBy({
          by: ["tournamentId"],
          where: { tournamentId: { in: ids }, status: "CONFIRMED" },
          _count: { id: true },
        })
      : [];
  const countMap = Object.fromEntries(confirmedByTournament.map((r) => [r.tournamentId, r._count.id]));
  const withConfirmed = tournaments.map((t) => ({
    ...t,
    confirmedCount: countMap[t.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">내 대회</h1>
        <Link
          href="/client/tournaments/new"
          className="rounded-lg bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          새 대회 만들기
        </Link>
      </div>
      {withConfirmed.length === 0 ? (
        <p className="text-gray-500">등록된 대회가 없습니다.</p>
      ) : (
        <ClientTournamentCards tournaments={withConfirmed} />
      )}
    </div>
  );
}
