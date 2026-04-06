import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { prisma } from "@/lib/db";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { normalizeSlug } from "@/lib/normalize-slug";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";

export const metadata = {
  title: "관리자홈",
};

function statusLabel(status: string): "모집중" | "마감" {
  return status === "OPEN" ? "모집중" : "마감";
}

function isBracketAllowed(status: string): boolean {
  return status !== "OPEN" && status !== "DRAFT";
}

type HomeTournament = {
  id: string;
  name: string;
  startAt: Date;
  status: string;
  nationalTournament: boolean;
  tournamentStage: string | null;
  applicantCount: number;
  approvedCount: number;
  pendingCount: number;
};

function resolveActionForBracket(t: HomeTournament): { href: string; label: string; disabled: boolean } {
  if (!isBracketAllowed(t.status)) {
    return { href: "#", label: "대진표", disabled: true };
  }
  if (!t.nationalTournament) {
    return { href: `/client/tournaments/${t.id}/bracket`, label: "대진표", disabled: false };
  }

  const stage = t.tournamentStage ?? "SETUP";
  const zoneStage = stage === "SETUP" || stage.startsWith("QUALIFIER");
  if (zoneStage) {
    return { href: `/client/tournaments/${t.id}/zones`, label: "권역배정", disabled: false };
  }
  return { href: `/client/tournaments/${t.id}/bracket`, label: "대진표", disabled: false };
}

export default async function ClientDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    const copy = await getAdminCopy();
    const c = copy as Record<AdminCopyKey, string>;
    return (
      <div className="space-y-4">
        <ConsolePageHeader
          title="관리자홈"
          description={getCopyValue(c, "client.dashboard.home.descriptionNoOrg")}
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {getCopyValue(c, "client.dashboard.home.noOrgTitle")}
        </p>
        <Link
          href="/client/setup"
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-xs font-medium dark:border-zinc-600"
        >
          사업장 설정
        </Link>
      </div>
    );
  }

  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, slug: true, setupCompleted: true },
  });
  const org = orgRow ? normalizeSlug(orgRow) : null;
  if (orgRow && !orgRow.setupCompleted) {
    redirect("/client/setup");
  }

  const tournaments = await prisma.tournament.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["OPEN", "CLOSED", "BRACKET_GENERATED"] },
    },
    orderBy: [{ startAt: "asc" }],
    select: {
      id: true,
      name: true,
      startAt: true,
      status: true,
      nationalTournament: true,
      tournamentStage: true,
      _count: { select: { entries: true } },
    },
  });

  const ids = tournaments.map((t) => t.id);
  const statusRows =
    ids.length > 0
      ? await prisma.tournamentEntry.groupBy({
          by: ["tournamentId", "status"],
          where: { tournamentId: { in: ids }, status: { in: ["CONFIRMED", "APPLIED"] } },
          _count: { id: true },
        })
      : [];

  const approvedMap = new Map<string, number>();
  const pendingMap = new Map<string, number>();
  for (const row of statusRows) {
    if (row.status === "CONFIRMED") approvedMap.set(row.tournamentId, row._count.id);
    if (row.status === "APPLIED") pendingMap.set(row.tournamentId, row._count.id);
  }

  const cards: HomeTournament[] = tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    startAt: t.startAt,
    status: t.status,
    nationalTournament: t.nationalTournament,
    tournamentStage: t.tournamentStage,
    applicantCount: t._count.entries,
    approvedCount: approvedMap.get(t.id) ?? 0,
    pendingCount: pendingMap.get(t.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="운영"
        title="관리자홈"
        description={org ? `「${org.name}」 운영 중 대회 바로가기` : "운영 중 대회 바로가기"}
      />

      <ConsoleSection title="운영 중 대회" flush>
        {cards.length === 0 ? (
          <p className="p-3 text-xs text-zinc-500 dark:text-zinc-400">운영 중인 대회가 없습니다.</p>
        ) : (
          <div className="grid gap-3 p-2 md:grid-cols-2">
            {cards.map((t) => {
              const bracketAction = resolveActionForBracket(t);
              return (
                <div
                  key={t.id}
                  className="relative rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <Link
                    href={`/client/tournaments/${t.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`${t.name} 대회현황으로 이동`}
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</h3>
                      <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium dark:border-zinc-600 dark:bg-zinc-800">
                        {statusLabel(t.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{formatKoreanDateWithWeekday(t.startAt)}</p>

                    <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
                      <dt className="text-zinc-500">신청자 수</dt>
                      <dd className="text-right font-semibold">{t.applicantCount}</dd>
                      <dt className="text-zinc-500">참가승인 수</dt>
                      <dd className="text-right font-semibold">{t.approvedCount}</dd>
                      <dt className="text-zinc-500">미승인 수</dt>
                      <dd className="text-right font-semibold">{t.pendingCount}</dd>
                    </dl>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Link
                        href={`/client/tournaments/${t.id}/participants`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-900 bg-zinc-900 px-2 text-[11px] font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        신청자관리
                      </Link>
                      {bracketAction.disabled ? (
                        <span className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                          {bracketAction.label}
                        </span>
                      ) : (
                        <Link
                          href={bracketAction.href}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
                        >
                          {bracketAction.label}
                        </Link>
                      )}
                      <Link
                        href={`/client/billing?tournament=${t.id}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 px-2 text-[11px] font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
                      >
                        정산
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
